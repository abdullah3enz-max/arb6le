'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
}

// Silent by design when there's nothing to show — a student with zero tickets shouldn't see an
// empty "support" box cluttering the dashboard; the NavBar link is how they discover it.
export function SupportWidget() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);

  useEffect(() => {
    fetch('/api/support/tickets')
      .then((r) => r.json())
      .then((d) => !d.error && setTickets(d.tickets));
  }, []);

  if (!tickets || tickets.length === 0) return null;

  const awaitingUser = tickets.filter((t) => t.status === 'AWAITING_USER');
  const open = tickets.filter((t) => t.status === 'OPEN');
  const firstAwaiting = awaitingUser[0];

  return (
    <Link
      href="/support"
      className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-surface p-4 shadow-card transition hover:border-accent-200"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink-900">🎫 تذاكر الدعم</p>
        {firstAwaiting ? (
          <p className="mt-0.5 truncate text-xs font-semibold text-accent-600">
            فيه رد جديد على "{firstAwaiting.subject}"
            {awaitingUser.length > 1 ? ` و${awaitingUser.length - 1} تذاكر ثانية` : ''}
          </p>
        ) : open.length > 0 ? (
          <p className="mt-0.5 text-xs text-ink-400">{open.length} تذكرة بانتظار رد فريق الدعم</p>
        ) : (
          <p className="mt-0.5 text-xs text-ink-400">كل تذاكرك مغلقة</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-semibold text-accent-500">فتح ←</span>
    </Link>
  );
}
