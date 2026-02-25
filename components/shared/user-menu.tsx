'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTranslations } from 'next-intl';
import LangToggle from './lang-toggle';
import ThemeToggle from './theme-toggle';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('admin.userMenu');

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-background hover:bg-stroke/10 transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User size={16} className="text-primary" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-medium truncate max-w-full">
              {user.name}
            </span>
            <span className="text-xs text-secondary truncate max-w-full">
              {user.email}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-secondary shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border border-stroke rounded-lg shadow-lg overflow-hidden z-50">
          <div className="p-3 border-b border-stroke">
            <div className="flex items-center justify-center gap-2">
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-error/10 transition-colors text-error font-medium"
          >
            <LogOut size={16} />
            <span>{t('logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
