#!/usr/bin/env python
"""Dead i18n key detector for admin_panel.

For every leaf key in messages/en.json, determines whether any t()/has()
call could resolve it. Understands:
  - useTranslations('literal.scope') / getTranslations('literal.scope')
  - useTranslations(namespace)   -> all `namespace=`/`namespace:` values at call sites
  - prop-passed t ({ t } in props, no local binding) -> caller's t scope
  - useTranslations()            -> root scope (keys are full paths)
  - dynamic keys t(`a.b.${x}`)   -> marks whole `a.b` subtree used

Usage: python scripts/dead-i18n.py [--apply]
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, 'messages', 'en.json')

EXCLUDE_DIRS = {'node_modules', '.next', 'messages', 'scripts'}

CALL_RE = re.compile(r'(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*([^)]*)\)')
KEY_RE_TPL = r'(?P<var>{vars})\s*\(\s*(?P<q>[\'"`])(?P<key>[^\'"`]+)\2'
METH_RE_TPL = r'(?P<var>{vars})\s*\.\s*(?:has|raw|rich|markup)\s*\(\s*(?P<q>[\'"`])(?P<key>[^\'"`]+)\2'
PROP_T_RE = re.compile(r'[{,]\s*t\s*[,}]|\bt:\s*\(')  # `t` in props destructure/type

def iter_source_files():
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f.endswith(('.ts', '.tsx')):
                yield os.path.join(root, f)

def jsx_tags(src, name):
    """Yield full <Name ...> opening-tag text (brace/string aware, tolerates `>`)."""
    pat = re.compile(r'<' + re.escape(name) + r'(?=[\s/>])')
    for m in pat.finditer(src):
        i = m.end()
        depth = 0
        quote = None
        while i < len(src):
            c = src[i]
            if quote:
                if c == quote and src[i - 1] != '\\':
                    quote = None
            elif c in '"\'':
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c == '>' and depth == 0:
                yield src[m.start():i + 1]
                break
            i += 1

def comp_name(path):
    """Best-effort exported component/hook name for call-site lookup."""
    base = os.path.splitext(os.path.basename(path))[0]
    src = open(path, encoding='utf-8').read()
    m = re.search(r'export\s+default\s+(?:function\s+)?(\w+)', src) or \
        re.search(r'export\s+(?:async\s+)?(?:function|const)\s+(\w+)', src)
    if m:
        return m.group(1)
    # fallback: filename → camelCase for hooks, PascalCase otherwise
    parts = re.split(r'[-_]', base)
    if base.startswith('use-') or base.startswith('use_'):
        return parts[0] + ''.join(p.capitalize() for p in parts[1:])
    return ''.join(p.capitalize() for p in parts)

def main():
    messages = json.load(open(MSG, encoding='utf-8'))

    # ---- Pass 1: per-file bindings + key usages -------------------------
    files = list(iter_source_files())
    bindings = {}        # path -> {var: scope|'@NSVAR'|''}
    usages = {}          # path -> [(var_or_None, key_or_template)]
    prop_t_files = []    # files whose t comes from props
    nsvar_files = []     # files binding a var to `namespace`

    for path in files:
        src = open(path, encoding='utf-8').read()
        b = {}
        for var, arg in CALL_RE.findall(src):
            arg = arg.strip()
            if arg in ('',):
                b[var] = ''
            elif arg.startswith(("'", '"')):
                b[var] = arg.strip('\'"')
            elif arg.startswith('`'):
                tpl = arg.strip('`')
                # `${namespace}.createManualOrder` → resolve via call-site ns values
                b[var] = '@NSVAR:' + tpl if '${' in tpl else tpl
            elif arg == 'namespace':
                b[var] = '@NSVAR'
            else:
                b[var] = '@NSVAR'  # any other expression — treat as ns-bound
        if not b:
            # collect bare t() calls as prop-t candidates
            us = [(None, k) for k in re.findall(r"(?<![\w.])t\s*\(\s*['\"`]([^'\"]+)['\"`]", src)]
            us += [(None, k) for k in re.findall(r"(?<![\w.])t\s*\(\s*`([^`]+)`", src)]
            # prop-t if `t` appears in a destructured props param or props type
            if us and re.search(r'[{,\s]t\s*[,}:\n]', src):
                prop_t_files.append(path)
            bindings[path] = {}
            usages[path] = us
            continue
        bindings[path] = b
        if not b:
            usages[path] = []
            continue
        vars_alt = '|'.join(re.escape(v) for v in b)
        pat = re.compile(KEY_RE_TPL.format(vars=vars_alt))
        mpat = re.compile(METH_RE_TPL.format(vars=vars_alt))
        us = []
        for m in pat.finditer(src):
            us.append((m.group('var'), m.group('key')))
        for m in mpat.finditer(src):
            us.append((m.group('var'), m.group('key')))
        usages[path] = us
        if any(str(v).startswith('@NSVAR') for v in b.values()):
            nsvar_files.append(path)

    # ---- Pass 2: namespaces for @NSVAR files ----------------------------
    # Map component name -> set of namespaces passed at call sites.
    all_src = {p: open(p, encoding='utf-8').read() for p in files}
    ns_of_comp = {}
    for p in nsvar_files:
        name = comp_name(p)
        scopes = set()
        # hook config: Name({ namespace: 'x'
        cfg = re.compile(re.escape(name) + r'\s*\(\s*\{[^}]*?namespace\s*:\s*[\'"]([^\'"]+)[\'"]', re.S)
        # default value in signature: namespace = 'x'
        dflt = re.search(r"namespace\s*=\s*['\"]([^'\"]+)['\"]", all_src[p])
        if dflt:
            scopes.add(dflt.group(1))
        ns_attr = re.compile(r'\bnamespace\s*=\s*["\']([^"\']+)["\']')
        for q, src in all_src.items():
            if q == p:
                continue
            for tag in jsx_tags(src, name):
                scopes.update(ns_attr.findall(tag))
            scopes.update(cfg.findall(src))
        ns_of_comp[p] = scopes or {'@UNKNOWN'}

    # ---- Pass 3: prop-t resolution (iterate for nested prop-t) ----------
    # scope_of_file[path] = set of scopes for the file's prop `t`
    scope_of_file = {}
    for _ in range(4):
        changed = False
        for p in prop_t_files:
            if p in scope_of_file:
                continue
            name = comp_name(p)
            t_attr = re.compile(r'\bt=\{(\w+)\}')
            scopes = set()
            def add_caller_var(q, var):
                caller_scope = bindings.get(q, {}).get(var)
                if isinstance(caller_scope, str) and caller_scope.startswith('@NSVAR'):
                    tpl = caller_scope[len('@NSVAR'):].lstrip(':')
                    for s in ns_of_comp.get(q, {'@UNKNOWN'}):
                        scopes.add(tpl.replace('${namespace}', s) if tpl else s)
                elif isinstance(caller_scope, str):
                    scopes.add(caller_scope)
                elif var in scope_of_file.get(q, set()):
                    scopes.update(scope_of_file[q])

            # hook-style config: Name({ t, ... }) or Name({ t: var, ... })
            cfg_t = re.compile(re.escape(name) + r'\s*\(\s*\{[^}]*?(?<![\w:])t\s*(?::\s*(\w+))?\s*,', re.S)
            for q, src in all_src.items():
                if q == p:
                    continue
                for tag in jsx_tags(src, name):
                    for var in t_attr.findall(tag):
                        add_caller_var(q, var)
                for m in cfg_t.finditer(src):
                    add_caller_var(q, m.group(1) or 't')
            if scopes:
                scope_of_file[p] = scopes
                changed = True
        if not changed:
            break

    # ---- Build used-key set ----------------------------------------------
    used = set()          # full dotted paths
    used_prefix = set()   # (scope, prefix) for dynamic templates
    unresolved = []       # (file, key) we couldn't scope — keep safe

    def mark(scope, key):
        if '${' in key:
            used_prefix.add((scope, key.split('${')[0]))
        else:
            used.add(scope + ('.' if scope else '') + key)

    for path in files:
        b = bindings[path]
        for var, key in usages[path]:
            if var is None:  # prop-t file
                scopes = scope_of_file.get(path)
                if scopes:
                    for s in scopes:
                        mark(s, key)
                else:
                    unresolved.append((path, key))
                continue
            scope = b.get(var)
            if scope is not None and scope.startswith('@NSVAR'):
                tpl = scope[len('@NSVAR'):].lstrip(':')
                scopes = ns_of_comp.get(path, {'@UNKNOWN'})
                for s in scopes:
                    if s == '@UNKNOWN':
                        unresolved.append((path, key))
                    else:
                        # expand ${namespace} inside template scopes
                        mark(tpl.replace('${namespace}', s) if tpl else s, key)
            elif scope is not None:
                mark(scope, key)

    # ---- Literal sweep: dotted string literals used via t(var) indirection --
    # e.g. maps like designReasonKey = { noTemplate: 'table.designReasonX' }
    leaf_set = set()
    def _leaves_into(node, prefix):
        for k, v in node.items():
            p = f'{prefix}.{k}' if prefix else k
            if isinstance(v, dict):
                _leaves_into(v, p)
            else:
                leaf_set.add(p)
    _leaves_into(messages, '')

    LIT_RE = re.compile(r'[\'"`]([A-Za-z_][\w]*(?:\.[A-Za-z_][\w$-]*)+)[\'"`]')
    for path in files:
        b = bindings[path]
        file_scopes = set()
        for v in b.values():
            if isinstance(v, str) and v.startswith('@NSVAR'):
                tpl = v[len('@NSVAR'):].lstrip(':')
                for s in ns_of_comp.get(path, set()):
                    if s != '@UNKNOWN':
                        file_scopes.add(tpl.replace('${namespace}', s) if tpl else s)
            elif isinstance(v, str):
                file_scopes.add(v)
        file_scopes.update(scope_of_file.get(path, set()) - {'@UNKNOWN'})
        if not file_scopes:
            continue
        src = all_src[path]
        for lit in LIT_RE.findall(src):
            for s in file_scopes:
                full = s + ('.' if s else '') + lit
                if full in leaf_set:
                    used.add(full)

    # ---- Evaluate every leaf ----------------------------------------------
    def leaves(node, prefix):
        out = []
        for k, v in node.items():
            p = f'{prefix}.{k}' if prefix else k
            if isinstance(v, dict):
                out += leaves(v, p)
            else:
                out.append(p)
        return out

    all_leaves = leaves(messages, '')

    def is_used(leaf):
        if leaf in used:
            return True
        # unresolved keys: keep if any leaf ENDS with the key (safe side)
        # dynamic prefix: leaf under a marked prefix
        for scope, pref in used_prefix:
            full = scope + ('.' if scope else '') + pref
            if leaf.startswith(full):
                return True
        return False

    # unresolved: mark leaves matching the tail path as used
    for path, key in unresolved:
        for leaf in all_leaves:
            if leaf == key or leaf.endswith('.' + key):
                used.add(leaf)

    dead = [l for l in all_leaves if not is_used(l)]
    dead.sort()

    # group by top namespace for readability
    from collections import defaultdict
    by_ns = defaultdict(list)
    for l in dead:
        by_ns[l.split('.')[0]].append(l)

    print(f'total leaves: {len(all_leaves)}  dead: {len(dead)}')
    print(f'\n== UNRESOLVED ({len(unresolved)}) ==')
    for p, k in unresolved:
        print(f'   {os.path.relpath(p, ROOT)}: {k}')
    print(f'\n== DYNAMIC PREFIXES ({len(used_prefix)}) ==')
    for s, pref in sorted(used_prefix):
        print(f'   {s} :: {pref}*')
    for ns, ks in sorted(by_ns.items()):
        print(f'\n== {ns} ({len(ks)}) ==')
        for k in ks[:60]:
            print('  ', k)
        if len(ks) > 60:
            print(f'   ... +{len(ks) - 60} more')

    with open(os.path.join(ROOT, 'dead-keys.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(dead) + '\n')

    if '--apply' in sys.argv:
        def prune(node, prefix):
            for k in list(node.keys()):
                p = f'{prefix}.{k}' if prefix else k
                if isinstance(node[k], dict):
                    prune(node[k], p)
                    if not node[k]:
                        del node[k]
                elif not is_used(p):
                    del node[k]
        for loc in ('en', 'ar'):
            mp = os.path.join(ROOT, 'messages', f'{loc}.json')
            d = json.load(open(mp, encoding='utf-8'))
            prune(d, '')
            with open(mp, 'w', encoding='utf-8', newline='\n') as f:
                f.write(json.dumps(d, ensure_ascii=False, indent=2))
            print(f'applied -> {loc}.json')

if __name__ == '__main__':
    main()
