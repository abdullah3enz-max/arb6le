'use client';

import { useEffect, useMemo, useState } from 'react';
import { TICKET_STATUS_LABEL, TICKET_STATUS_ORDER } from '@/lib/admin/ticketLabels';
import { TicketDrawer, type Ticket } from '@/components/admin/TicketDrawer';

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  lastMessageAt: string;
  user: { id: string; email: string; name: string | null };
  assignedTo: { id: string; email: string; name: string | null } | null;
  _count: { messages: number };
}

interface Staff {
  id: string;
  email: string;
  name: string | null;
}

const STATUS_FILTERS = [{ key: 'ALL', label: 'الكل' }, ...TICKET_STATUS_ORDER.map((s) => ({ key: s, label: TICKET_STATUS_LABEL[s] }))] as const;

export function SupportClient({ canManage }: { canManage: boolean }) {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);

  function load() {
    fetch('/api/admin/support/tickets')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setTickets(d.tickets)));
  }

  function loadOpenTicket(id: string) {
    fetch(`/api/admin/support/tickets/${id}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setOpenTicket(d.ticket)))
      .catch(() => {});
  }

  useEffect(() => {
    load();
    if (canManage) {
      fetch('/api/admin/support/assignees')
        .then((r) => r.json())
        .then((d) => !d.error && setStaff(d.staff));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openTicketId) loadOpenTicket(openTicketId);
    else setOpenTicket(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTicketId]);

  const filtered = useMemo(() => {
    if (!tickets) return null;
    if (statusFilter === 'ALL') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  function refreshAfterChange() {
    load();
    if (openTicketId) loadOpenTicket(openTicketId);
  }

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!tickets) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">الدعم</h1>
        <p className="mt-1 text-sm text-ink-500">تذاكر الدعم اللي فتحها الطلاب — رد عليها من هنا، مباشرة يشوفونه بحسابهم.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={
              'rounded-full px-3 py-1.5 text-xs font-semibold ' +
              (statusFilter === f.key ? 'bg-accent-500 text-white' : 'border border-ink-100 bg-surface text-ink-600')
            }
          >
            {f.label}
            {f.key !== 'ALL' && (
              <span className="mr-1.5 opacity-70">({tickets.filter((t) => t.status === f.key).length})</span>
            )}
          </button>
        ))}
      </div>

      {filtered && filtered.length === 0 && <p className="text-sm text-ink-400">ما فيه تذاكر مطابقة.</p>}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الموضوع</th>
                <th className="px-4 py-2 text-right">الطالب</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">المسؤول</th>
                <th className="px-4 py-2 text-right">آخر نشاط</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenTicketId(t.id)}
                  className="cursor-pointer border-t border-ink-100 hover:bg-ink-50/60"
                >
                  <td className="px-4 py-2">
                    <p className="font-semibold text-ink-900">{t.subject}</p>
                    <p className="text-xs text-ink-400">{t._count.messages} رسالة</p>
                  </td>
                  <td className="px-4 py-2 text-ink-600">{t.user.name ?? t.user.email}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-xs font-bold ' +
                        (t.status === 'OPEN'
                          ? 'bg-accent-50 text-accent-600'
                          : t.status === 'AWAITING_USER'
                            ? 'bg-ink-100 text-ink-500'
                            : 'bg-emerald-50 text-emerald-600')
                      }
                    >
                      {TICKET_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{t.assignedTo ? (t.assignedTo.name ?? t.assignedTo.email) : '—'}</td>
                  <td className="px-4 py-2 text-ink-400">{new Date(t.lastMessageAt).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openTicket && (
        <TicketDrawer
          ticket={openTicket}
          staff={staff}
          canManage={canManage}
          onClose={() => setOpenTicketId(null)}
          onChanged={refreshAfterChange}
        />
      )}
    </div>
  );
}
