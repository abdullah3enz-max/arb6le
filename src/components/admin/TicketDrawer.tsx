'use client';

import { useState } from 'react';
import { TICKET_STATUS_LABEL, TICKET_STATUS_ORDER } from '@/lib/admin/ticketLabels';

export interface TicketMessage {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  author: { name: string | null; email: string };
}

export interface Ticket {
  id: string;
  subject: string;
  status: string;
  user: { id: string; email: string; name: string | null };
  assignedTo: { id: string; email: string; name: string | null } | null;
  createdAt: string;
  messages: TicketMessage[];
}

export function TicketDrawer({
  ticket,
  staff,
  canManage,
  onClose,
  onChanged
}: {
  ticket: Ticket;
  staff: { id: string; email: string; name: string | null }[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل التحديث.');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل إرسال الرد.');
      setReplyText('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="scrollbar-thin flex h-full w-full max-w-lg flex-col bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-ink-900">{ticket.subject}</h2>
            <p className="text-xs text-ink-400">
              {ticket.user.name ?? ticket.user.email} · {new Date(ticket.createdAt).toLocaleString('ar-SA')}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-ink-400 hover:text-ink-700">
            ✕
          </button>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-4">
            <select
              value={ticket.status}
              onChange={(e) => patch({ status: e.target.value })}
              disabled={saving}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-900"
            >
              {TICKET_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={ticket.assignedTo?.id ?? ''}
              onChange={(e) => patch({ assignedToId: e.target.value || null })}
              disabled={saving}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-900"
            >
              <option value="">بدون تعيين</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="px-5 pt-3 text-sm font-semibold text-accent-600">{error}</p>}

        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-5">
          {ticket.messages.map((m) => (
            <div key={m.id} className={'flex ' + (m.isStaff ? 'justify-start' : 'justify-end')}>
              <div
                className={
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ' +
                  (m.isStaff ? 'bg-accent-50 text-ink-900' : 'bg-ink-100 text-ink-900')
                }
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[10px] text-ink-400">
                  {m.isStaff ? '🎧 ' : ''}
                  {m.author.name ?? m.author.email} · {new Date(m.createdAt).toLocaleString('ar-SA')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {canManage ? (
          <div className="border-t border-ink-100 p-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              placeholder="اكتب ردك..."
              className="w-full resize-none rounded-xl border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-accent-500"
            />
            <button
              onClick={sendReply}
              disabled={sending || !replyText.trim()}
              className="mt-2 w-full rounded-xl bg-accent-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {sending ? 'جاري الإرسال...' : 'إرسال الرد'}
            </button>
          </div>
        ) : (
          <p className="border-t border-ink-100 p-4 text-center text-xs text-ink-400">
            عندك صلاحية العرض فقط — ما تقدر ترد أو تعدّل هذي التذكرة.
          </p>
        )}
      </div>
    </div>
  );
}
