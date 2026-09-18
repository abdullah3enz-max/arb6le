'use client';

import { Fragment, useEffect, useState } from 'react';

interface PermissionDef {
  key: string;
  category: string;
  descriptionAr: string;
}
interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  overrides: { key: string; granted: boolean }[];
}
interface PermissionsData {
  permissions: PermissionDef[];
  rolePermissions: { role: string; key: string }[];
  staff: StaffMember[];
}

const ROLES = ['ADMIN', 'SUPPORT', 'SALES', 'FINANCE', 'ANALYST'] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'مدير',
  SUPPORT: 'الدعم',
  SALES: 'المبيعات',
  FINANCE: 'المالية',
  ANALYST: 'محلل'
};
const CATEGORY_LABEL: Record<string, string> = {
  users: 'المستخدمون',
  crm: 'CRM',
  subscriptions: 'الاشتراكات',
  payments: 'المدفوعات',
  support: 'الدعم',
  analytics: 'التحليلات',
  marketing: 'التسويق',
  content: 'المحتوى',
  employees: 'الموظفون',
  settings: 'الإعدادات',
  security: 'الأمان'
};

export function RolesClient() {
  const [data, setData] = useState<PermissionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  function load() {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
  }

  useEffect(load, []);

  async function toggleRole(role: string, key: string, granted: boolean) {
    setData((d) =>
      d
        ? {
            ...d,
            rolePermissions: granted
              ? [...d.rolePermissions, { role, key }]
              : d.rolePermissions.filter((rp) => !(rp.role === role && rp.key === key))
          }
        : d
    );
    await fetch('/api/admin/permissions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'role', role, key, granted })
    });
  }

  async function toggleOverride(userId: string, key: string, granted: boolean) {
    await fetch('/api/admin/permissions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'user', userId, key, granted })
    });
    load();
  }

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const editablePermissions = data.permissions.filter((p) => p.key !== 'owner_only_actions');
  const categories = Array.from(new Set(editablePermissions.map((p) => p.category)));
  const selectedStaff = data.staff.find((s) => s.id === selectedStaffId) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">الأدوار والصلاحيات</h1>
        <p className="mt-1 text-sm text-ink-500">
          كل دور له صلاحيات افتراضية. المالك (Owner) دائمًا كامل الصلاحيات ولا يظهر هنا — ولا يمكن منح "إجراءات
          المالك فقط" لأي أحد.
        </p>
      </div>

      <section className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-500">
            <tr>
              <th className="px-4 py-2 text-right">الصلاحية</th>
              {ROLES.map((r) => (
                <th key={r} className="px-4 py-2 text-center">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="border-t border-ink-100 bg-ink-50/60">
                  <td colSpan={ROLES.length + 1} className="px-4 py-1.5 text-xs font-bold text-ink-500">
                    {CATEGORY_LABEL[cat] ?? cat}
                  </td>
                </tr>
                {editablePermissions
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <tr key={p.key} className="border-t border-ink-100">
                      <td className="px-4 py-2 text-ink-700">{p.descriptionAr}</td>
                      {ROLES.map((r) => {
                        const checked = data.rolePermissions.some((rp) => rp.role === r && rp.key === p.key);
                        return (
                          <td key={r} className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleRole(r, p.key, e.target.checked)}
                              className="h-4 w-4 accent-accent-500"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">استثناء لموظف محدد</h2>
        <p className="mb-3 text-xs text-ink-400">
          امنح أو اسحب صلاحية معيّنة لموظف واحد بغض النظر عن دوره — يفوز دائمًا على افتراضي الدور.
        </p>
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className="mb-4 rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
        >
          <option value="">اختر موظفًا...</option>
          {data.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.email} — {ROLE_LABEL[s.role] ?? s.role}
            </option>
          ))}
        </select>

        {selectedStaff && (
          <div className="grid gap-2 rounded-xl2 border border-ink-100 bg-surface p-4 sm:grid-cols-2">
            {editablePermissions.map((p) => {
              const override = selectedStaff.overrides.find((o) => o.key === p.key);
              const roleDefault = data.rolePermissions.some((rp) => rp.role === selectedStaff.role && rp.key === p.key);
              const effective = override ? override.granted : roleDefault;
              return (
                <label key={p.key} className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={effective}
                    onChange={(e) => toggleOverride(selectedStaff.id, p.key, e.target.checked)}
                    className="h-4 w-4 accent-accent-500"
                  />
                  <span>{p.descriptionAr}</span>
                  {override && <span className="text-[10px] font-bold text-accent-500">(استثناء)</span>}
                </label>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
