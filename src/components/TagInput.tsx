'use client';

import { useState } from 'react';

/**
 * Free-text chip input. Deliberately not a fixed dropdown list — item 2 asks the system to
 * "search real works, not just rely on a static list." A true autocomplete needs a live
 * catalogue API (TMDB/football data/etc.) which isn't wired in this scaffold, so this stays
 * honest: the user can type ANY title, and the backend treats it as free text passed to the
 * Connection Finder rather than a fake canned suggestion list.
 */
export function TagInput({
  values,
  onChange,
  placeholder
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const value = draft.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft('');
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-surface p-2 focus-within:border-accent-500">
      <div className="flex flex-wrap gap-2 p-1">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-800">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-ink-400 hover:text-accent-600">
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-2 py-1 text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>
    </div>
  );
}
