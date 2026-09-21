'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WORLD_LABEL } from '@/lib/admin/worldLabels';

interface Overview {
  userCount: number;
  newUsersThisWeek: number;
  activeSubscriptions: number;
  documentsTotal: number;
  failedDocuments: number;
  aiCostCentsTotal: number;
  aiGenerationsTotal: number;
  feedbackCounts: { reaction: string; _count: number }[];
  popularWorlds: { worldCategory: string; _count: number }[];
  planBreakdown: { planId: string; code: string; nameAr: string; count: number; mrrCents: number }[];
  mrrCents: number;
  signupTrend: { date: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    user: { email: string; name: string | null } | null;
  }[];
}

const REACTION_LABEL: Record<string, string> = {
  LOVE: '😍 أعجبني كثيرًا',
  LIKE: '👍 أعجبني',
  NEUTRAL: '😐 عادي',
  DISLIKE: '👎 ما أعجبني',
  INCORRECT: '❌ غلط'
};

function fmtNumber(n: number) {
  return n.toLocaleString('ar-SA');
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

  const maxSignup = Math.max(1, ...data.signupTrend.map((d) => d.count));
  const maxWorld = Math.max(1, ...data.popularWorlds.map((w) => w._count));
  const totalActivePlans = Math.max(1, data.planBreakdown.reduce((s, p) => s + p.count, 0));
  const sortedWorlds = [...data.popularWorlds].sort((a, b) => b._count - a._count);
  const sortedPlans = [...data.planBreakdown].sort((a, b) => b.count - a.count);
  const totalFeedback = data.feedbackCounts.reduce((s, f) => s + f._count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">نظرة عامة</h1>
        <p className="mt-1 text-sm text-ink-500">وضع المنصة الحالي — أرقام حقيقية من قاعدة البيانات، بدون بيانات تجريبية.</p>
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">المستخدمون والاشتراكات</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="إجمالي المستخدمين" value={fmtNumber(data.userCount)} />
          <Stat label="مستخدمون جدد (٧ أيام)" value={fmtNumber(data.newUsersThisWeek)} />
          <Stat label="اشتراكات فعّالة" value={fmtNumber(data.activeSubscriptions)} />
          <Stat label="إيراد شهري متكرر (MRR)" value={`${(data.mrrCents / 100).toFixed(2)} ر.س`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">الملفات والذكاء الاصطناعي</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="ملفات تمت معالجتها" value={fmtNumber(data.documentsTotal)} />
          <Stat label="ملفات فشلت" value={fmtNumber(data.failedDocuments)} tone={data.failedDocuments > 0 ? 'warn' : undefined} />
          <Stat label="عمليات AI" value={fmtNumber(data.aiGenerationsTotal)} />
          <Stat label="تكلفة AI (دولار)" value={(data.aiCostCentsTotal / 100).toFixed(2)} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">مستخدمون جدد آخر ١٤ يوم</h2>
          <Link href="/admin/customers/users" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
            كل المستخدمين ←
          </Link>
        </div>
        <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
          {data.signupTrend.every((d) => d.count === 0) ? (
            <p className="py-6 text-center text-sm text-ink-400">ما فيه تسجيلات بهالفترة.</p>
          ) : (
            <>
              <div className="flex h-32 gap-1.5">
                {data.signupTrend.map((d) => (
                  <div key={d.date} className="group relative flex flex-1 flex-col justify-end">
                    <div
                      className="w-full rounded-t bg-accent-500"
                      style={{ height: `${Math.max(2, (d.count / maxSignup) * 100)}%` }}
                    />
                    <div className="pointer-events-none absolute bottom-full right-1/2 z-10 mb-1 hidden translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[10px] text-ink-50 group-hover:block">
                      {d.date}: {d.count} مستخدم
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-ink-400">
                <span>{data.signupTrend[0]?.date}</span>
                <span>{data.signupTrend[data.signupTrend.length - 1]?.date}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">توزيع الباقات (اشتراكات فعّالة)</h2>
            <Link href="/admin/subscriptions/plans" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
              الباقات ←
            </Link>
          </div>
          <div className="space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
            {sortedPlans.length === 0 && <p className="text-sm text-ink-400">ما فيه اشتراكات فعّالة بعد.</p>}
            {sortedPlans.map((p) => (
              <div key={p.planId}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-800">{p.nameAr}</span>
                  <span className="text-xs text-ink-400">
                    {fmtNumber(p.count)} ({((p.count / totalActivePlans) * 100).toFixed(0)}%) · {(p.mrrCents / 100).toFixed(2)} ر.س
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${(p.count / totalActivePlans) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">أكثر الاهتمامات ظهورًا بالروابط المقبولة</h2>
            <Link href="/admin/erbotli-ai/interests" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
              التفاصيل ←
            </Link>
          </div>
          <div className="space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
            {sortedWorlds.length === 0 && <p className="text-sm text-ink-400">ما فيه روابط مقبولة بعد.</p>}
            {sortedWorlds.map((w) => (
              <div key={w.worldCategory}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-800">{WORLD_LABEL[w.worldCategory] ?? w.worldCategory}</span>
                  <span className="text-xs text-ink-400">{fmtNumber(w._count)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${(w._count / maxWorld) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">ملاحظات الطلاب على الروابط</h2>
          <Link href="/admin/erbotli-ai/linking-analytics" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
            تحليلات الربط ←
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {data.feedbackCounts.length === 0 && (
            <p className="rounded-xl2 border border-ink-100 bg-surface px-4 py-3 text-sm text-ink-400">ما فيه ملاحظات بعد.</p>
          )}
          {data.feedbackCounts.map((f) => (
            <div key={f.reaction} className="rounded-xl2 border border-ink-100 bg-surface px-4 py-3">
              <p className="text-xs text-ink-400">{REACTION_LABEL[f.reaction] ?? f.reaction}</p>
              <p className="text-lg font-extrabold text-ink-900">
                {fmtNumber(f._count)}
                {totalFeedback > 0 && <span className="mr-1 text-xs font-semibold text-ink-400">({((f._count / totalFeedback) * 100).toFixed(0)}%)</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">آخر العمليات</h2>
          <Link href="/admin/system/audit-logs" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
            سجل الأمان الكامل ←
          </Link>
        </div>
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
