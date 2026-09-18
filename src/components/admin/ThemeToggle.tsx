'use client';

export function ThemeToggle({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-ink-200"
      title="تبديل المظهر"
    >
      <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
      <span>{theme === 'dark' ? 'داكن' : 'فاتح'}</span>
    </button>
  );
}
