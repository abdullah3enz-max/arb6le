'use client';

import { useEffect, useState } from 'react';

interface Overview {
  userCount: number;
  activeSubscriptions: number;
  documentsTotal: number;
  failedDocuments: number;
  aiCostCentsTotal: number;
  aiGenerationsTotal: number;
  feedbackCounts: { reaction: string; _count: number }[];
  popularWorlds: { worldCategory: string; _count: number }[];
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
  subscriptions: { plan: { nameAr: string; code: string } }[];
}

export function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'users' | 'feedback'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [feedback, setFeedback] = useState<
    { id: string; reaction: string; generatedClaim: string; user: { email: string }; connection: { worldRef: string } }[] | null
  >(null);

  useEffect(() => {
    fetch('/api/admin/overview').then((r) => r.json()).then((d) => setOverview(d));
  }, []);

  useEffect(() => {
    if (tab === 'users' && !users) fetch('/api/admin/users').then((r) => r.json()).then((d) => setUsers(d.users));
    if (tab === 'feedback' && !feedback) fetch('/api/admin/feedback').then((r) => r.json()).then((d) => setFeedback(d.feedback));
  }, [tab, users, feedback]);

  async function toggleStatus(userId: string, current: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, status: current === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
    });
    setUsers((u) => u?.map((x) => (x.id === userId ? { ...x, status: current === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' } : x)) ?? null);
  }

  async function changePlan(userId: string, planCode: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, planCode })
    });
    setUsers(null); // force refetch to reflect the new plan
    setTab('users');
  }

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {(
          [
            ['overview', 'نظرة عامة'],
            ['users', 'المستخدمون'],
            ['feedback', 'الملاحظات السلبية']
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold ' +
              (tab === key ? 'bg-ink-900 text-white' : 'border border-ink-100 bg-white text-ink-600')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="المستخدمون" value={overview.userCount} />
          <Stat label="اشتراكات فعّالة" value={overview.activeSubscriptions} />
          <Stat label="ملفات مرفوعة" value={overview.documentsTotal} />
          <Stat label="ملفات فاشلة" value={overview.failedDocuments} tone={overview.failedDocuments > 0 ? 'warn' : undefined} />
          <Stat label="تكلفة AI (دولار)" value={(overview.aiCostCentsTotal / 100).toFixed(2)} />
          <Stat label="عمليات AI" value={overview.aiGenerationsTotal} />
        </div>
      )}

      {tab === 'users' && (
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">البريد</th>
                <th className="px-4 py-2 text-right">الخطة</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-ink-100">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      defaultValue={u.subscriptions[0]?.plan.code ?? 'FREE'}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                      className="rounded-lg border border-ink-100 px-2 py-1"
                    >
                      <option value="FREE">مجاني</option>
                      <option value="PLUS">بلَس</option>
                      <option value="PRO">برو</option>
                    </select>
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

      {tab === 'feedback' && (
        <div className="space-y-3">
          {feedback?.length === 0 && <p className="text-sm text-ink-400">ما فيه ملاحظات سلبية حاليًا 🎉</p>}
          {feedback?.map((f) => (
            <div key={f.id} className="rounded-xl2 border border-ink-100 bg-white p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-ink-400">
                <span>{f.user.email}</span>
                <span className="font-bold text-accent-600">{f.reaction}</span>
              </div>
              <p className="text-sm font-semibold text-ink-900">{f.connection.worldRef}</p>
              <p className="text-sm text-ink-600">{f.generatedClaim}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-white p-4 shadow-card">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={'mt-1 text-xl font-extrabold ' + (tone === 'warn' ? 'text-accent-600' : 'text-ink-900')}>{value}</p>
    </div>
  );
}
