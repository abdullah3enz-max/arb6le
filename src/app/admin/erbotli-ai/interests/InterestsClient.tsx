'use client';

import { useEffect, useState } from 'react';

interface InterestsData {
  selectionCounts: { category: string; count: number; avgDocuments: number; avgQuizScore: number | null }[];
  performance: { category: string; total: number; acceptanceRate: number | null; positive: number; negative: number }[];
}

const WORLD_LABEL: Record<string, string> = {
  SERIES: '📺 مسلسلات',
  MOVIES: '🎬 أفلام',
  FOOTBALL: '⚽ كورة',
  GAMES: '🎮 ألعاب',
  ANIME: '🇯🇵 أنمي',
  CARS: '🚗 سيارات',
  MUSIC: '🎵 موسيقى',
  PEOPLE: '👤 مشاهير',
  CHARACTERS: '🦸 شخصيات',
  BOOKS: '📚 كتب',
  DAILY_LIFE: '☀️ حياة يومية'
};

function pct(v: number | null) {
  return v === null ? '—' : `${(v * 100).toFixed(0)}%`;
}

export function InterestsClient() {
  const [data, setData] = useState<InterestsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/interests')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
  }, []);

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const sortedSelection = [...data.selectionCounts].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...sortedSelection.map((s) => s.count));
  const performanceMap = new Map(data.performance.map((p) => [p.category, p]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">اهتمامات الطلاب</h1>
        <p className="mt-1 text-sm text-ink-500">أكثر الاهتمامات اختيارًا، وأداء كل فئة فعليًا بالربط (من بيانات onboarding والملاحظات الحقيقية).</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">الأكثر اختيارًا</h2>
        {sortedSelection.length === 0 && <p className="text-sm text-ink-400">ما فيه اختيارات مسجّلة بعد.</p>}
        <div className="space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
          {sortedSelection.map((s) => (
            <div key={s.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-800">{WORLD_LABEL[s.category] ?? s.category}</span>
                <span className="text-xs text-ink-400">{s.count.toLocaleString('ar-SA')} طالب</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-accent-500" style={{ width: `${(s.count / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">أداء الربط حسب الاهتمام</h2>
        <p className="mb-3 text-xs text-ink-400">نسبة القبول من الملاحظات الفعلية للروابط المبنية على كل اهتمام.</p>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الاهتمام</th>
                <th className="px-4 py-2 text-right">عدد الملاحظات</th>
                <th className="px-4 py-2 text-right">نسبة القبول</th>
              </tr>
            </thead>
            <tbody>
              {sortedSelection.map((s) => {
                const perf = performanceMap.get(s.category);
                return (
                  <tr key={s.category} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{WORLD_LABEL[s.category] ?? s.category}</td>
                    <td className="px-4 py-2 text-ink-500">{perf?.total ?? 0}</td>
                    <td className="px-4 py-2 text-ink-500">{perf ? pct(perf.acceptanceRate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">هل الاهتمام يرتبط بتفاعل أكبر فعليًا؟</h2>
        <p className="mb-3 text-xs text-ink-400">
          متوسط عدد الملفات المعالجة ومتوسط درجة الاختبارات للطلاب اللي اختاروا كل اهتمام — مؤشر تفاعل حقيقي، مو
          تخمين.
        </p>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الاهتمام</th>
                <th className="px-4 py-2 text-right">متوسط الملفات المعالجة</th>
                <th className="px-4 py-2 text-right">متوسط درجة الاختبار</th>
              </tr>
            </thead>
            <tbody>
              {sortedSelection.map((s) => (
                <tr key={s.category} className="border-t border-ink-100">
                  <td className="px-4 py-2 font-semibold text-ink-800">{WORLD_LABEL[s.category] ?? s.category}</td>
                  <td className="px-4 py-2 text-ink-500">{s.avgDocuments.toFixed(1)}</td>
                  <td className="px-4 py-2 text-ink-500">{s.avgQuizScore === null ? '—' : `${s.avgQuizScore.toFixed(0)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
