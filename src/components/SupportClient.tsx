'use client';

import { useEffect, useState } from 'react';
import { SupportTicketThread, type TicketDetail } from '@/components/SupportTicketThread';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  assignedTo: { name: string | null; email: string } | null;
  _count: { messages: number };
}

const STATUS_LABEL: Record<string, string> = { OPEN: 'بانتظار الرد', AWAITING_USER: 'فيه رد جديد 🎉', CLOSED: 'مغلقة' };
const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-ink-100 text-ink-500',
  AWAITING_USER: 'bg-accent-50 text-accent-600',
  CLOSED: 'bg-emerald-500/10 text-emerald-500'
};

export function SupportClient() {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [openTicket, setOpenTicket] = useState<TicketDetail | null>(null);

  function load() {
    fetch('/api/support/tickets')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setTickets(d.tickets)));
  }

  useEffect(load, []);

  function openTicketId(id: string) {
    fetch(`/api/support/tickets/${id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setOpenTicket(d.ticket)));
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل إنشاء التذكرة.');
      setSubject('');
      setBody('');
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">الدعم</h1>
          <p className="mt-1 text-sm text-ink-500">عندك مشكلة أو سؤال؟ افتح تذكرة وفريقنا يردّ عليك هنا مباشرة.</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
        >
          + تذكرة جديدة
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-accent-600">{error}</p>}

      {formOpen && (
        <form
          onSubmit={createTicket}
          className="animate-fade-up space-y-3 rounded-2xl border border-ink-100 bg-surface p-5 shadow-card"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">الموضوع</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثال: ما يشتغل رفع الملف"
              className="w-full rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">وش المشكلة بالتفصيل؟</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اشرح المشكلة..."
              className="w-full resize-none rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            />
          </div>
          <button
            disabled={creating}
            className="w-full rounded-xl bg-accent-500 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {creating ? 'جاري الإرسال...' : 'إرسال التذكرة'}
          </button>
        </form>
      )}

      {!tickets && !error && <p className="text-sm text-ink-400">جاري التحميل...</p>}
      {tickets && tickets.length === 0 && (
        <p className="rounded-2xl border border-ink-100 bg-surface p-8 text-center text-sm text-ink-400">
          ما فتحت أي تذكرة دعم بعد.
        </p>
      )}

      {tickets && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicketId(t.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-ink-100 bg-surface p-4 text-right shadow-card transition hover:border-accent-200"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{t.subject}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {t._count.messages} رسالة · {new Date(t.lastMessageAt).toLocaleDateString('ar-SA')}
                </p>
              </div>
              <span className={'shrink-0 rounded-full px-3 py-1 text-xs font-bold ' + (STATUS_TONE[t.status] ?? '')}>
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {openTicket && (
        <SupportTicketThread
          ticket={openTicket}
          onClose={() => setOpenTicket(null)}
          onReplied={() => {
            openTicketId(openTicket.id);
            load();
          }}
        />
      )}
    </div>
  );
}
