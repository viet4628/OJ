import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'oj_theme';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  // If user system preference is dark
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(THEME_KEY, theme);
}

// Global hook for reactive theme state across all mounted components
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);

    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    applyTheme(next);
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent('theme-change', { detail: next }));
  };

  useEffect(() => {
    const handleCustomEvent = (e: any) => {
      if (e.detail && (e.detail === 'dark' || e.detail === 'light')) {
        setThemeState(e.detail);
      }
    };
    window.addEventListener('theme-change', handleCustomEvent);
    return () => window.removeEventListener('theme-change', handleCustomEvent);
  }, []);

  return { theme, isDark: theme === 'dark', toggleTheme };
}

