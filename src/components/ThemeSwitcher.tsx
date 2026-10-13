'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initial = stored || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  if (!mounted) {
    return <div className="size-9 shrink-0" aria-hidden />;
  }

  const label = `Ganti ke mode ${theme === 'dark' ? 'terang' : 'gelap'}`;
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="inline-grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-fg-3 transition-colors hover:border-line-strong hover:text-fg"
    >
      <Icon className="size-4" strokeWidth={1.8} aria-hidden />
    </button>
  );
}
