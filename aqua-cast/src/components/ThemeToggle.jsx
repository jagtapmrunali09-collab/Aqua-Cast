import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      onClick={onToggle}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline-strong text-ink-muted transition-colors hover:border-water-500 hover:text-water-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-water-300 dark:hover:text-water-300"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
