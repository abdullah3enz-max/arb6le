import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActivePlan } from '@/lib/billing/entitlements';
import { NavBar } from '@/components/NavBar';

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [plans, activePlan] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyCents: 'asc' } }),
    getActivePlan(user.id)
  ]);

  const paymentProviderConfigured = process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'none';

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role !== 'STUDENT'} />
      <h1 className="mt-8 mb-2 text-2xl font-extrabold text-ink-900">الخطط</h1>
      <p className="mb-8 text-ink-500">اختر الخطة المناسبة لك — الأسعار قابلة للتعديل من لوحة الإدارة.</p>

      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const limits = plan.limitsJson as {
            maxDocuments: number;
            maxConnectionsPerMonth: number;
            maxQuizzesPerMonth: number;
            studyMode: boolean;
            spacedRepetition: boolean;
            prioritySupport: boolean;
          };
          const isActive = plan.id === activePlan.id;
          return (
            <div
              key={plan.id}
              className={
                'rounded-xl2 border p-6 shadow-card ' + (isActive ? 'border-accent-500 bg-accent-50/40' : 'border-ink-100 bg-surface')
              }
            >
              <h2 className="text-lg font-extrabold text-ink-900">{plan.nameAr}</h2>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">
                {plan.priceMonthlyCents === 0 ? 'مجاني' : `${(plan.priceMonthlyCents / 100).toFixed(0)} ${plan.currency}`}
                {plan.priceMonthlyCents > 0 && <span className="text-sm font-normal text-ink-400"> / شهر</span>}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-ink-600">
                <li>📄 {limits.maxDocuments < 0 ? 'ملفات غير محدودة' : `${limits.maxDocuments} ملفات شهريًا`}</li>
                <li>🔗 {limits.maxConnectionsPerMonth < 0 ? 'روابط غير محدودة' : `${limits.maxConnectionsPerMonth} ربط شهريًا`}</li>
                <li>🎯 {limits.maxQuizzesPerMonth < 0 ? 'اختبارات غير محدودة' : `${limits.maxQuizzesPerMonth} اختبار شهريًا`}</li>
                {limits.studyMode && <li>🎧 Study Mode</li>}
                {limits.spacedRepetition && <li>🔁 مراجعة ذكية (Spaced Repetition)</li>}
                {limits.prioritySupport && <li>⚡ أولوية بالمعالجة</li>}
              </ul>

              {isActive ? (
                <div className="mt-6 rounded-full bg-accent-500 py-2 text-center text-sm font-bold text-white">خطتك الحالية</div>
              ) : paymentProviderConfigured ? (
                <button className="mt-6 w-full rounded-full border border-ink-200 py-2 text-sm font-bold text-ink-800 hover:bg-ink-100">
                  ترقية
                </button>
              ) : (
                <p className="mt-6 text-center text-xs text-ink-400">
                  الدفع غير مفعّل بعد — تواصل مع الدعم للترقية اليدوية.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
