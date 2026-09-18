'use client';

import { useEffect, useState } from 'react';

interface LogRow {
  id: string;
  action: string;
  summary: string;
  metaJson: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string; name: string | null } | null;
}

export function AuditLogsClient() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pageSize = 40;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (actionFilter.trim()) params.set('action', actionFilter.trim());
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : (setLogs(d.logs), setTotal(d.total))));
  }, [page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">سجل الأمان (Audit Logs)</h1>
        <p className="mt-1 text-sm text-ink-500">سجل للقراءة فقط — لا يمكن تعديله أو حذفه من الواجهة.</p>
      </div>

      <input
        value={actionFilter}
        onChange={(e) => {
          setPage(1);
          setActionFilter(e.target.value);
        }}
        placeholder="فلترة حسب نوع العملية (مثال: user_status)..."
        className="w-72 rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400"
      />

      {error && <p className="text-sm font-semibold text-accent-600">{error}</p>}
      {!logs && !error && <p className="text-sm text-ink-400">جاري التحميل...</p>}
      {logs?.length === 0 && <p className="text-sm text-ink-400">ما فيه عمليات مطابقة.</p>}

      {logs && logs.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500">
                <tr>
                  <th className="px-4 py-2 text-right">الوقت</th>
                  <th className="px-4 py-2 text-right">من</th>
                  <th className="px-4 py-2 text-right">الحدث</th>
                  <th className="px-4 py-2 text-right">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-ink-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-500">{new Date(l.createdAt).toLocaleString('ar-SA')}</td>
                    <td className="px-4 py-2 text-ink-700">{l.user?.name ?? l.user?.email ?? 'النظام'}</td>
                    <td className="px-4 py-2">
                      <p className="font-semibold text-ink-900">{l.summary}</p>
                      <p className="text-[11px] text-ink-400" title={JSON.stringify(l.metaJson)}>
                        {l.action}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-400">{l.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-ink-500">
            <span>
              صفحة {page} من {totalPages} — {total} عملية
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-ink-100 px-3 py-1 disabled:opacity-40"
              >
                السابق
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-ink-100 px-3 py-1 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
