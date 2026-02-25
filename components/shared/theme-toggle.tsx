'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import Button from '../ui/button';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <Button
      variant="icon"
      size="custom"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Moon size={19} className="hidden dark:block" />
      <Sun size={19} className="dark:hidden" />
    </Button>
  );
}
