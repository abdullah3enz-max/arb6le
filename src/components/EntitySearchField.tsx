'use client';

import { useEffect, useRef, useState } from 'react';
import type { SearchEntity } from '@/app/api/search/anime/route';

/**
 * Live search-as-you-type against a real catalogue (item 3): image + name + short info per
 * result, "+ إضافة" to add, selected picks shown as chips below. Backed by a real free API
 * (Jikan/Deezer) — never a canned list, and never a fabricated image.
 */
export function EntitySearchField({
  endpoint,
  placeholder,
  selected,
  onChange
}: {
  endpoint: string;
  placeholder: string;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, endpoint]);

  function add(name: string) {
    if (!selected.includes(name)) onChange([...selected, name]);
    setQuery('');
    setResults([]);
  }

  function remove(name: string) {
    onChange(selected.filter((v) => v !== name));
  }

  return (
    <div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
        />
        {loading && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-ink-400">...</span>}
      </div>

      {results.length > 0 && (
        <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-xl border border-ink-100 bg-surface p-2 shadow-card">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => add(r.name)}
              disabled={selected.includes(r.name)}
              className="flex items-center gap-3 rounded-lg p-2 text-right transition hover:bg-ink-100 disabled:opacity-40"
            >
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt={r.name} className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-lg">✨</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{r.name}</span>
                {r.subtitle && <span className="block truncate text-xs text-ink-400">{r.subtitle}</span>}
              </span>
              <span className="shrink-0 text-xs font-bold text-accent-500">{selected.includes(r.name) ? '✓' : '+ إضافة'}</span>
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((name) => (
            <span key={name} className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-800">
              {name}
              <button onClick={() => remove(name)} className="text-ink-400 hover:text-accent-500">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
