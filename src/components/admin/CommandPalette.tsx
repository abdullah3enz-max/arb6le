'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserHit {
  kind: 'user';
  id: string;
  email: string;
  name: string | null;
}

interface LeadHit {
  kind: 'lead';
  id: string;
  name: string;
  email: string | null;
}

type Hit = UserHit | LeadHit;

/**
 * Cmd/Ctrl+K global search. Now wired to customers (users) and CRM leads — the two entities that
 * exist so far. Extend the same pattern (fetch the list, filter client-side, tag with `kind`) for
 * tickets/transactions once those exist; same modal, same shortcut.
 *
 * Fully controlled (open/onClose from the parent) rather than owning its own open state, so both
 * the keyboard shortcut AND the topbar "search" button can drive the same single instance
 * instead of racing two independent state machines.
 */
export function CommandPalette({
  open,
  onClose,
  canSearchUsers,
  canSearchLeads
}: {
  open: boolean;
  onClose: () => void;
  canSearchUsers: boolean;
  canSearchLeads: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const canSearchAnything = canSearchUsers || canSearchLeads;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const q = query.trim().toLowerCase();
    const handle = setTimeout(async () => {
      const [userHits, leadHits] = await Promise.all([
        canSearchUsers
          ? fetch('/api/admin/users')
              .then((r) => (r.ok ? r.json() : { users: [] }))
              .then((d) =>
                (d.users as { id: string; email: string; name: string | null }[])
                  .filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q))
                  .slice(0, 5)
                  .map((u): UserHit => ({ kind: 'user', id: u.id, email: u.email, name: u.name }))
              )
          : Promise.resolve([]),
        canSearchLeads
          ? fetch('/api/admin/leads')
              .then((r) => (r.ok ? r.json() : { leads: [] }))
              .then((d) =>
                (d.leads as { id: string; name: string; email: string | null }[])
                  .filter((l) => l.name.toLowerCase().includes(q) || (l.email ?? '').toLowerCase().includes(q))
                  .slice(0, 5)
                  .map((l): LeadHit => ({ kind: 'lead', id: l.id, name: l.name, email: l.email }))
              )
          : Promise.resolve([])
      ]);
      setResults([...userHits, ...leadHits]);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open, canSearchUsers, canSearchLeads]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl2 border border-ink-100 bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={canSearchAnything ? 'دوّر على مستخدم أو عميل محتمل...' : 'ابحث...'}
          className="w-full border-b border-ink-100 bg-transparent px-5 py-4 text-ink-900 outline-none placeholder:text-ink-400"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {!canSearchAnything && <p className="px-3 py-4 text-center text-sm text-ink-400">ما عندك صلاحية بحث حاليًا.</p>}
          {canSearchAnything && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-ink-400">ما فيه نتائج.</p>
          )}
          {results.map((hit) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              onClick={() => {
                onClose();
                router.push(hit.kind === 'user' ? '/admin/customers/users' : '/admin/customers/leads');
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right hover:bg-ink-50"
            >
              <span className="flex flex-col items-start">
                <span className="text-sm font-semibold text-ink-900">{hit.kind === 'user' ? hit.name ?? hit.email : hit.name}</span>
                <span className="text-xs text-ink-400">{hit.kind === 'user' ? hit.email : hit.email ?? '—'}</span>
              </span>
              <span className="text-[10px] font-bold text-ink-400">{hit.kind === 'user' ? 'مستخدم' : 'عميل محتمل'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
