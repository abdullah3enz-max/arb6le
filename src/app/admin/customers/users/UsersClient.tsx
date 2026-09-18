'use client';

import { useEffect, useMemo, useState } from 'react';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  subscriptions: { plan: { nameAr: string; code: string } }[];
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'الكل' },
  { key: 'ACTIVE', label: 'فعّال' },
  { key: 'DISABLED', label: 'معطّل' }
] as const;

export function UsersClient() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['key']>('ALL');

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setUsers(d.users)));
  }, []);

  async function toggleStatus(userId: string, current: string) {
    const nextStatus = current === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, status: nextStatus })
    });
    if (!res.ok) return;
    setUsers((u) => u?.map((x) => (x.id === userId ? { ...x, status: nextStatus } : x)) ?? null);
  }

  async function changePlan(userId: string, planCode: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, planCode })
    });
    if (!res.ok) return;
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users));
  }

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q);
    });
  }, [users, search, statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">المستخدمون</h1>
        <p className="mt-1 text-sm text-ink-500">كل الطلاب المسجّلين بالمنصة.</p>
      </div>

      {error && <p className="text-sm font-semibold text-accent-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="دوّر بالإيميل أو الاسم..."
          className="w-64 rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400"
        />
        <div className="flex gap-1.5">
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
            </button>
          ))}
        </div>
      </div>

      {!users && !error && <p className="text-sm text-ink-400">جاري التحميل...</p>}
      {filtered && filtered.length === 0 && <p className="text-sm text-ink-400">ما فيه نتائج مطابقة.</p>}

      {filtered && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">البريد</th>
                <th className="px-4 py-2 text-right">الخطة</th>
                <th className="px-4 py-2 text-right">تاريخ التسجيل</th>
                <th className="px-4 py-2 text-right">آخر دخول</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-ink-100">
                  <td className="px-4 py-2">
                    <p className="font-semibold text-ink-900">{u.name ?? '—'}</p>
                    <p className="text-xs text-ink-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      defaultValue={u.subscriptions[0]?.plan.code ?? 'FREE'}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                      className="rounded-lg border border-ink-100 bg-surface px-2 py-1 text-ink-900"
                    >
                      <option value="FREE">مجاني</option>
                      <option value="PLUS">بلَس</option>
                      <option value="PRO">برو</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{new Date(u.createdAt).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-2 text-ink-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA') : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={u.status === 'ACTIVE' ? 'text-emerald-600' : 'text-accent-600'}>
                      {u.status === 'ACTIVE' ? 'فعّال' : 'معطّل'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleStatus(u.id, u.status)} className="text-xs font-semibold text-accent-600 hover:underline">
                      {u.status === 'ACTIVE' ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
