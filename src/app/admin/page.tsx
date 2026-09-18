'use client';

import { useEffect, useState } from 'react';

interface Overview {
  userCount: number;
  newUsersThisWeek: number;
  activeSubscriptions: number;
  documentsTotal: number;
  failedDocuments: number;
  aiCostCentsTotal: number;
  aiGenerationsTotal: number;
  recentActivity: {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    user: { email: string; name: string | null } | null;
  }[];
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
  }, []);

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">نظرة عامة</h1>
        <p className="mt-1 text-sm text-ink-500">وضع المنصة الحالي — أرقام حقيقية من قاعدة البيانات، بدون بيانات تجريبية.</p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">المستخدمون والاشتراكات</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="إجمالي المستخدمين" value={data.userCount} />
          <Stat label="مستخدمون جدد (٧ أيام)" value={data.newUsersThisWeek} />
          <Stat label="اشتراكات فعّالة" value={data.activeSubscriptions} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">الملفات والذكاء الاصطناعي</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="ملفات تمت معالجتها" value={data.documentsTotal} />
          <Stat label="ملفات فشلت" value={data.failedDocuments} tone={data.failedDocuments > 0 ? 'warn' : undefined} />
          <Stat label="عمليات AI" value={data.aiGenerationsTotal} />
          <Stat label="تكلفة AI (دولار)" value={(data.aiCostCentsTotal / 100).toFixed(2)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">آخر العمليات</h2>
        <div className="rounded-xl2 border border-ink-100 bg-surface">
          {data.recentActivity.length === 0 && <p className="p-6 text-center text-sm text-ink-400">ما فيه عمليات مسجّلة بعد.</p>}
          {data.recentActivity.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-ink-100 px-5 py-3 last:border-0">
              <div>
                <p className="text-sm font-semibold text-ink-800">{a.summary}</p>
                <p className="text-xs text-ink-400">{a.user?.name ?? a.user?.email ?? 'النظام'}</p>
              </div>
              <span className="text-xs text-ink-400">{new Date(a.createdAt).toLocaleString('ar-SA')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={'mt-1 text-xl font-extrabold ' + (tone === 'warn' ? 'text-accent-600' : 'text-ink-900')}>{value}</p>
    </div>
  );
}
