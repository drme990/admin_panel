'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Leaf, Sparkles, Palette } from 'lucide-react';
import { ADMIN_THEMES, type AdminTheme } from '../providers/theme-provider';
import { useState, useRef, useEffect } from 'react';

const THEME_CONFIG: Record<AdminTheme, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Light' },
  black: { icon: Moon, label: 'Black' },
  manasik: { icon: Leaf, label: 'Manasik' },
  ghadaq: { icon: Sparkles, label: 'Ghadaq' },
  colors: { icon: Palette, label: 'Colors' },
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentTheme = (theme as AdminTheme) || 'black';
  const CurrentIcon = THEME_CONFIG[currentTheme]?.icon ?? Moon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-3 rounded-md text-success bg-background border border-stroke flex items-center justify-center transition-colors hover:bg-muted"
        aria-label="Change theme"
      >
        <CurrentIcon size={19} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-background border border-stroke rounded-lg shadow-lg overflow-hidden z-50 min-w-35">
          {ADMIN_THEMES.map((t) => {
            const Icon = THEME_CONFIG[t].icon;
            const isActive = currentTheme === t;
            return (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'gradient-site gradient-text font-semibold'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon size={16} />
                <span>{THEME_CONFIG[t].label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
