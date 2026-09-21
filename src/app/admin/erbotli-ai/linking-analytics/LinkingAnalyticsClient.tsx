'use client';

import { useEffect, useState } from 'react';
import { WORLD_LABEL } from '@/lib/admin/worldLabels';

interface FeedbackRow {
  id: string;
  reaction: string;
  generatedClaim: string;
  user: { email: string };
  connection: { worldRef: string };
}

interface ReactionSummary {
  total: number;
  acceptanceRate: number | null;
  positive: number;
  negative: number;
}

interface LinkingAnalytics {
  totalConnections: number;
  byStatus: { status: string; count: number }[];
  regeneratedCount: number;
  regenerationRate: number;
  overall: ReactionSummary;
  byAssociationLevel: (ReactionSummary & { level: string })[];
  byWorldCategory: (ReactionSummary & { category: string })[];
  topFeedbackUsers: { userId: string; email: string; name: string | null; total: number; acceptanceRate: number | null; negative: number }[];
  quizPerformanceByLevel: { level: string; totalAnswers: number; correctRate: number | null }[];
}

const LEVEL_LABEL: Record<string, string> = {
  DIRECT_MATCH: 'تطابق مباشر',
  PHONETIC: 'تشابه صوتي',
  VISUAL: 'تشابه بصري',
  FAMOUS_ASSOCIATION: 'شخصية مشهورة',
  CONTEXTUAL: 'سياقي'
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض (نقد)',
  BELOW_THRESHOLD: 'دون الحد الأدنى',
  NO_CONNECTION_FOUND: 'ما لقينا رابط',
  PENDING_CRITIC: 'بانتظار النقد'
};

function pct(v: number | null) {
  return v === null ? '—' : `${(v * 100).toFixed(0)}%`;
}

export function LinkingAnalyticsClient() {
  const [data, setData] = useState<LinkingAnalytics | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/linking-analytics')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
    fetch('/api/admin/feedback')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setFeedback(d.feedback)));
  }, []);

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">تحليلات الربط</h1>
        <p className="mt-1 text-sm text-ink-500">أداء محرك الربط الحقيقي — من جداول Connection وConnectionFeedback مباشرة.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الروابط" value={data.totalConnections.toLocaleString('ar-SA')} />
        <Stat label="نسبة القبول ❤️👍" value={pct(data.overall.acceptanceRate)} />
        <Stat label="ملاحظات سلبية 👎" value={data.overall.negative.toLocaleString('ar-SA')} />
        <Stat label="نسبة إعادة التوليد 🔄" value={`${(data.regenerationRate * 100).toFixed(0)}%`} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">حسب حالة الرابط</h2>
        <div className="flex flex-wrap gap-3">
          {data.byStatus.map((s) => (
            <div key={s.status} className="rounded-xl2 border border-ink-100 bg-surface px-4 py-3">
              <p className="text-xs text-ink-400">{STATUS_LABEL[s.status] ?? s.status}</p>
              <p className="text-lg font-extrabold text-ink-900">{s.count.toLocaleString('ar-SA')}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">أي مستوى ربط ينجح فعليًا؟</h2>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">المستوى</th>
                <th className="px-4 py-2 text-right">ملاحظات</th>
                <th className="px-4 py-2 text-right">قبول</th>
                <th className="px-4 py-2 text-right">سلبية</th>
              </tr>
            </thead>
            <tbody>
              {data.byAssociationLevel.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-400">
                    ما فيه ملاحظات كافية بعد.
                  </td>
                </tr>
              )}
              {data.byAssociationLevel
                .sort((a, b) => b.total - a.total)
                .map((l) => (
                  <tr key={l.level} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{LEVEL_LABEL[l.level] ?? l.level}</td>
                    <td className="px-4 py-2 text-ink-500">{l.total}</td>
                    <td className="px-4 py-2 text-ink-500">{pct(l.acceptanceRate)}</td>
                    <td className="px-4 py-2 text-accent-600">{l.negative}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">حسب فئة الاهتمام</h2>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الفئة</th>
                <th className="px-4 py-2 text-right">ملاحظات</th>
                <th className="px-4 py-2 text-right">قبول</th>
              </tr>
            </thead>
            <tbody>
              {data.byWorldCategory.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-400">
                    ما فيه ملاحظات كافية بعد.
                  </td>
                </tr>
              )}
              {data.byWorldCategory
                .sort((a, b) => b.total - a.total)
                .map((w) => (
                  <tr key={w.category} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{WORLD_LABEL[w.category] ?? w.category}</td>
                    <td className="px-4 py-2 text-ink-500">{w.total}</td>
                    <td className="px-4 py-2 text-ink-500">{pct(w.acceptanceRate)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">أي مستوى ربط فعلًا يساعد الطالب يتذكر؟</h2>
        <p className="mb-3 text-xs text-ink-400">
          مو رضا المستخدم بس — نسبة الإجابات الصحيحة الفعلية بالاختبارات، لكل مفهوم حسب مستوى الربط اللي استخدمه.
        </p>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">المستوى</th>
                <th className="px-4 py-2 text-right">عدد الإجابات</th>
                <th className="px-4 py-2 text-right">نسبة الصح</th>
              </tr>
            </thead>
            <tbody>
              {data.quizPerformanceByLevel.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-400">
                    ما فيه محاولات اختبار كافية بعد لقياس هذا.
                  </td>
                </tr>
              )}
              {data.quizPerformanceByLevel
                .sort((a, b) => b.totalAnswers - a.totalAnswers)
                .map((l) => (
                  <tr key={l.level} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{LEVEL_LABEL[l.level] ?? l.level}</td>
                    <td className="px-4 py-2 text-ink-500">{l.totalAnswers}</td>
                    <td className="px-4 py-2 text-ink-500">{pct(l.correctRate)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">أكثر الطلاب تفاعلاً بالملاحظات</h2>
        <p className="mb-3 text-xs text-ink-400">مين يعطي ملاحظات أكثر، ووش نسبة رضاه العامة عن الروابط اللي وصلته.</p>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الطالب</th>
                <th className="px-4 py-2 text-right">عدد الملاحظات</th>
                <th className="px-4 py-2 text-right">نسبة القبول</th>
                <th className="px-4 py-2 text-right">سلبية</th>
              </tr>
            </thead>
            <tbody>
              {data.topFeedbackUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-400">
                    ما فيه ملاحظات كافية بعد.
                  </td>
                </tr>
              )}
              {data.topFeedbackUsers.map((u) => (
                <tr key={u.userId} className="border-t border-ink-100">
                  <td className="px-4 py-2 text-ink-800">{u.name ?? u.email}</td>
                  <td className="px-4 py-2 text-ink-500">{u.total}</td>
                  <td className="px-4 py-2 text-ink-500">{pct(u.acceptanceRate)}</td>
                  <td className="px-4 py-2 text-accent-600">{u.negative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">🔍 طابور مراجعة الجودة (ملاحظات سلبية)</h2>
        {feedback?.length === 0 && <p className="text-sm text-ink-400">ما فيه ملاحظات سلبية حاليًا 🎉</p>}
        <div className="space-y-3">
          {feedback?.map((f) => (
            <div key={f.id} className="rounded-xl2 border border-ink-100 bg-surface p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-ink-400">
                <span>{f.user.email}</span>
                <span className="font-bold text-accent-600">{f.reaction}</span>
              </div>
              <p className="text-sm font-semibold text-ink-900">{f.connection.worldRef}</p>
              <p className="text-sm text-ink-600">{f.generatedClaim}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-ink-900">{value}</p>
    </div>
  );
}
