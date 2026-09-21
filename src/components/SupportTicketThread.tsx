'use client';

import { useState } from 'react';

const STATUS_LABEL: Record<string, string> = { OPEN: 'بانتظار الرد', AWAITING_USER: 'فيه رد جديد', CLOSED: 'مغلقة' };

export interface TicketMessage {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  author: { name: string | null; email: string };
}

export interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: TicketMessage[];
}

export function SupportTicketThread({ ticket, onClose, onReplied }: { ticket: TicketDetail; onClose: () => void; onReplied: () => void }) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'فشل إرسال الرد.');
      setReplyText('');
      onReplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="scrollbar-thin flex h-full w-full max-w-lg flex-col border-r border-ink-100 bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-ink-900">{ticket.subject}</h2>
            <p className="text-xs text-ink-400">{STATUS_LABEL[ticket.status] ?? ticket.status}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-ink-400 hover:text-ink-700">
            ✕
          </button>
        </div>

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
                  {m.isStaff ? `🎧 فريق الدعم` : 'أنت'} · {new Date(m.createdAt).toLocaleString('ar-SA')}
                </p>
              </div>
            </div>
          ))}
        </div>

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
            className="mt-2 w-full rounded-xl bg-accent-500 py-2.5 text-sm font-bold text-white transition hover:bg-accent-600 disabled:opacity-50"
          >
            {sending ? 'جاري الإرسال...' : 'إرسال'}
          </button>
        </div>
      </div>
    </div>
  );
}
