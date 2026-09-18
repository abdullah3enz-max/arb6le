'use client';

import { useEffect, useState } from 'react';

interface Employee {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'المالك',
  ADMIN: 'مدير',
  SUPPORT: 'الدعم',
  SALES: 'المبيعات',
  FINANCE: 'المالية',
  ANALYST: 'محلل'
};

const CREATABLE_ROLES = ['ADMIN', 'SUPPORT', 'SALES', 'FINANCE', 'ANALYST'] as const;

export function EmployeesClient() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SUPPORT' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    fetch('/api/admin/employees')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setEmployees(d.employees)));
  }

  useEffect(load, []);

  async function toggleStatus(userId: string, current: string) {
    const nextStatus = current === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const res = await fetch('/api/admin/employees', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, status: nextStatus })
    });
    if (res.ok) setEmployees((e) => e?.map((x) => (x.id === userId ? { ...x, status: nextStatus } : x)) ?? null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل إنشاء الموظف.');
      setFormOpen(false);
      setForm({ name: '', email: '', password: '', role: 'SUPPORT' });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">الموظفون</h1>
          <p className="mt-1 text-sm text-ink-500">حسابات فريق العمل (غير الطلاب).</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600"
        >
          + إضافة موظف
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submitForm} className="space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
          <p className="text-xs text-ink-400">
            ما فيه بريد دعوة تلقائي بعد — شارك كلمة المرور مع الموظف مباشرة بعد الإنشاء.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="الاسم"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
            <input
              required
              type="email"
              placeholder="البريد الإلكتروني"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="كلمة مرور مبدئية (٨ أحرف فأكثر)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
            >
              {CREATABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm font-semibold text-accent-600">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>
      )}

      {error && <p className="text-sm font-semibold text-accent-600">{error}</p>}
      {!employees && !error && <p className="text-sm text-ink-400">جاري التحميل...</p>}

      {employees && (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الاسم</th>
                <th className="px-4 py-2 text-right">الدور</th>
                <th className="px-4 py-2 text-right">آخر دخول</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-ink-100">
                  <td className="px-4 py-2">
                    <p className="font-semibold text-ink-900">{e.name ?? '—'}</p>
                    <p className="text-xs text-ink-400">{e.email}</p>
                  </td>
                  <td className="px-4 py-2 text-ink-700">{ROLE_LABEL[e.role] ?? e.role}</td>
                  <td className="px-4 py-2 text-ink-500">{e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleString('ar-SA') : '—'}</td>
                  <td className="px-4 py-2">
                    <span className={e.status === 'ACTIVE' ? 'text-emerald-600' : 'text-accent-600'}>
                      {e.status === 'ACTIVE' ? 'فعّال' : 'معطّل'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {e.role !== 'OWNER' && (
                      <button onClick={() => toggleStatus(e.id, e.status)} className="text-xs font-semibold text-accent-600 hover:underline">
                        {e.status === 'ACTIVE' ? 'تعليق' : 'تفعيل'}
                      </button>
                    )}
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
