'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground"
        aria-label="Toggle theme"
      >
        <Monitor className="h-4 w-4" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const icon =
    theme === 'light' ? (
      <Sun className="h-4 w-4" />
    ) : theme === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const label =
    theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System theme';

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-2',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors'
      )}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
