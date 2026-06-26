'use client';

import { useRef, useState } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';
import Input from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';

interface MultiNameInputProps {
  /** The current value as a newline-joined list of names */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  isRTL?: boolean;
  error?: string;
}

export default function MultiNameInput({
  value,
  onChange,
  placeholder,
  maxLength,
  isRTL,
  error,
}: MultiNameInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const names = value
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  const addName = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...names, trimmed].join('\n'));
    setDraft('');
    inputRef.current?.focus();
  };

  const removeName = (idx: number) => {
    onChange(names.filter((_, i) => i !== idx).join('\n'));
  };

  const commitSingleDraftIfNeeded = () => {
    const trimmed = draft.trim();
    if (!trimmed || names.length > 0) return;
    onChange(trimmed);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addName();
          }
        }}
        onBlur={commitSingleDraftIfNeeded}
        maxLength={maxLength}
        placeholder={placeholder}
        dir={isRTL ? 'rtl' : 'ltr'}
        error={error}
        suffix={
          <Tooltip
            content={isRTL ? 'أضف اسماً آخر' : 'Add another name'}
            position="top"
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={addName}
              disabled={!draft.trim()}
              className="flex h-6 w-6 items-center justify-center rounded bg-primary text-background transition-colors hover:bg-primary/80 disabled:opacity-30"
              aria-label={isRTL ? 'أضف اسمًا' : 'Add name'}
            >
              <LuPlus size={14} />
            </button>
          </Tooltip>
        }
      />

      {/* Name chips */}
      {names.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {names.map((name, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-foreground rounded-full text-sm border border-primary/20"
            >
              {name}
              <button
                type="button"
                onClick={() => removeName(idx)}
                className="text-secondary hover:text-error transition-colors"
                aria-label={`Remove ${name}`}
              >
                <LuX size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
