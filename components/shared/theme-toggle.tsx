'use client';

import { useTheme } from 'next-themes';
import { LuSun, LuMoon, LuLeaf, LuSparkles, LuPalette } from 'react-icons/lu';
import { ADMIN_THEMES, type AdminTheme } from '../providers/theme-provider';
import { useState, useRef, useEffect } from 'react';
import Button from '../ui/button';

const THEME_CONFIG: Record<AdminTheme, { icon: typeof LuSun; label: string }> =
  {
    light: { icon: LuSun, label: 'Light' },
    black: { icon: LuMoon, label: 'Black' },
    manasik: { icon: LuLeaf, label: 'Manasik' },
    ghadaq: { icon: LuSparkles, label: 'Ghadaq' },
    colors: { icon: LuPalette, label: 'Colors' },
  };

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentTheme = (theme as AdminTheme) || 'black';
  const CurrentIcon = THEME_CONFIG[currentTheme]?.icon ?? LuMoon;

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
      <Button
        variant="icon"
        size="custom"
        onClick={() => setOpen(!open)}
        aria-label="Change theme"
      >
        <CurrentIcon size={19} />
      </Button>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-background border border-stroke rounded-lg shadow-lg overflow-hidden z-50 min-w-35">
          {ADMIN_THEMES.map((t) => {
            const Icon = THEME_CONFIG[t].icon;
            const isActive = currentTheme === t;
            return (
              <Button
                variant="custom"
                size="custom"
                type="button"
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
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
