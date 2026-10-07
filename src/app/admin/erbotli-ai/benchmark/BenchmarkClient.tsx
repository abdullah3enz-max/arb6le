'use client';

import { useCallback, useEffect, useState } from 'react';

interface Metrics {
  facts: number;
  withAssociation: number;
  noStrongAssociation: number;
  errors: number;
  bySection: Record<string, number>;
  byType: Record<string, number>;
  rejectedTotal: number;
  rejectedByReason: Record<string, number>;
  hallucinationsCaught: number;
  avgLinkWords: number;
  fromInterest: number;
  distinctTypes: number;
  byCategory: Record<string, { facts: number; withAssociation: number }>;
  examples: { fact: string; profile: string; link: string; type: string; quality: number }[];
  rejectedExamples: { fact: string; link: string; code: string }[];
}

interface Run {
  id: string;
  action: string;
  createdAt: string;
  meta: { runId: string; model: string; limit: number; metrics?: Metrics; error?: string; finishedAt?: string };
}

interface BenchmarkData {
  currentModel: string;
  runs: Run[];
  goodRate: Record<string, { good: number; bad: number; rate: number | null }>;
}

const SECTION_LABEL: Record<string, string> = {
  numbers: '🔢 أرقام',
  sound: '🔊 صوتي وكلمات',
  screen: '🎬 أفلام ومسلسلات',
  anime: '🍥 أنمي',
  games: '🎮 ألعاب',
  sports: '⚽ رياضة',
  concept: '🧠 مفاهيمي'
};

const CATEGORY_LABEL: Record<string, string> = {
  numbers: 'أرقام',
  english_words: 'كلمات إنجليزية',
  medical_terms: 'مصطلحات طبية',
  concepts: 'مفاهيم',
  names: 'أسماء'
};

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

export function BenchmarkClient() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [limit, setLimit] = useState(20);
  const [model, setModel] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/association-benchmark');
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function start() {
    setMessage(null);
    const res = await fetch('/api/admin/association-benchmark', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit, model: model.trim() || undefined })
    });
    const body = await res.json().catch(() => null);
    setMessage(res.ok ? 'بدأ الاختبار — النتيجة تظهر هنا لما يخلص (تتحدث كل 15 ثانية).' : body?.error ?? 'فشل التشغيل.');
    load();
  }

  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const finished = data.runs.filter((r) => r.action === 'association.benchmark' && r.meta.metrics).slice(0, 4);
  const doneIds = new Set(data.runs.filter((r) => r.action !== 'association.benchmark.started').map((r) => r.meta.runId));
  const running = data.runs.filter((r) => r.action === 'association.benchmark.started' && !doneIds.has(r.meta.runId));
  const failed = data.runs.filter((r) => r.action === 'association.benchmark.failed').slice(0, 3);

  const rows: [string, (m: Metrics) => string | number][] = [
    ['عدد المعلومات', (m) => m.facts],
    ['لها رابط قوي', (m) => `${m.withAssociation} (${pct(m.withAssociation, m.facts)})`],
    ['بدون رابط قوي (رفض صادق)', (m) => m.noStrongAssociation],
    ['أخطاء', (m) => m.errors],
    ...Object.entries(SECTION_LABEL).map(([k, label]) => [label, (m: Metrics) => m.bySection[k] ?? 0] as [string, (m: Metrics) => number]),
    ['أنواع ربط مختلفة (تنوع)', (m) => m.distinctTypes],
    ['من اهتمامات الطالب', (m) => m.fromInterest],
    ['مرفوضة', (m) => m.rejectedTotal],
    ['هلوسة انمسكت (غلط/مختلق)', (m) => m.hallucinationsCaught],
    ['متوسط طول الرابط (كلمات)', (m) => m.avgLinkWords]
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">🧪 اختبار محرك الربط</h1>
        <p className="mt-1 text-sm text-ink-500">
          نفس الـ100 معلومة (20 أرقام، 20 كلمات إنجليزية، 20 مصطلحات طبية، 20 مفاهيم، 20 أسماء) مع 7 ملفات اهتمامات —
          شغّله بأكثر من نموذج وقارن بالأرقام. النموذج الحالي: <span className="font-mono">{data.currentModel}</span>
        </p>
      </div>

      <section className="flex flex-wrap items-end gap-3 rounded-xl2 border border-ink-100 bg-surface p-4">
        <label className="text-xs font-bold text-ink-500">
          عدد المعلومات
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="mt-1 block rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-xs font-bold text-ink-500">
          نموذج آخر للمقارنة (اختياري)
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="فاضي = النموذج الحالي"
            dir="ltr"
            className="mt-1 block w-full rounded-lg border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <button onClick={start} className="rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white hover:bg-accent-600">
          ▶️ شغّل الاختبار
        </button>
        <p className="w-full text-xs text-ink-400">كل معلومة تكلف 4 نداءات تقريبًا (3 بحث + حكم). 100 معلومة ≈ 400 نداء.</p>
        {message && <p className="w-full text-xs font-semibold text-accent-600">{message}</p>}
      </section>

      {running.length > 0 && (
        <p className="text-sm text-ink-500">
          ⏳ قيد التشغيل: {running.map((r) => `${r.meta.model} (${r.meta.limit})`).join('، ')}
        </p>
      )}
      {failed.map((r) => (
        <p key={r.id} className="text-xs text-accent-600">
          ❌ فشل {r.meta.model}: {r.meta.error}
        </p>
      ))}

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold text-ink-900">المقارنة (آخر {finished.length} تشغيلات)</h2>
          <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500">
                <tr>
                  <th className="px-4 py-2 text-right">المقياس</th>
                  {finished.map((r) => (
                    <th key={r.id} className="px-4 py-2 text-right font-mono text-xs" dir="ltr">
                      {r.meta.model}
                      <div className="font-sans text-[10px] text-ink-400">{new Date(r.createdAt).toLocaleString('ar-SA')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label} className="border-t border-ink-100">
                    <td className="px-4 py-2 font-semibold text-ink-800">{label}</td>
                    {finished.map((r) => (
                      <td key={r.id} className="px-4 py-2 text-ink-600">
                        {value(r.meta.metrics!)}
                      </td>
                    ))}
                  </tr>
                ))}
                {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                  <tr key={k} className="border-t border-ink-100">
                    <td className="px-4 py-2 text-ink-500">نجاح: {label}</td>
                    {finished.map((r) => {
                      const c = r.meta.metrics!.byCategory[k];
                      return (
                        <td key={r.id} className="px-4 py-2 text-ink-600">
                          {c ? `${c.withAssociation}/${c.facts}` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {finished[0] && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-bold text-ink-900">أمثلة مقبولة (آخر تشغيل)</h2>
            <ul className="space-y-2">
              {finished[0].meta.metrics!.examples.map((e, i) => (
                <li key={i} className="rounded-xl border border-ink-100 bg-surface px-3 py-2 text-sm">
                  <span className="text-ink-500">{e.fact}</span> <span className="font-bold text-ink-900" dir="auto">{e.link}</span>
                  <span className="text-xs text-ink-400"> · {e.type} · {e.quality} · {e.profile}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 text-sm font-bold text-ink-900">أسباب الرفض</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(finished[0].meta.metrics!.rejectedByReason)
                .sort((a, b) => b[1] - a[1])
                .map(([code, n]) => (
                  <span key={code} className="rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600">
                    {code}: {n}
                  </span>
                ))}
            </div>
            <ul className="space-y-2">
              {finished[0].meta.metrics!.rejectedExamples.map((e, i) => (
                <li key={i} className="rounded-xl border border-dashed border-ink-100 px-3 py-2 text-sm text-ink-500">
                  {e.fact} → <span dir="auto">{e.link}</span> <span className="text-xs text-accent-600">({e.code})</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">نسبة "ممتاز" الفعلية من الطلاب حسب نوع الربط</h2>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">النوع</th>
                <th className="px-4 py-2 text-right">👍</th>
                <th className="px-4 py-2 text-right">👎</th>
                <th className="px-4 py-2 text-right">Good rate</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.goodRate).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-400">
                    ما فيه تقييمات بعد.
                  </td>
                </tr>
              )}
              {Object.entries(data.goodRate).map(([type, r]) => (
                <tr key={type} className="border-t border-ink-100">
                  <td className="px-4 py-2 font-semibold text-ink-800">{type}</td>
                  <td className="px-4 py-2 text-ink-600">{r.good}</td>
                  <td className="px-4 py-2 text-ink-600">{r.bad}</td>
                  <td className="px-4 py-2 text-ink-600">{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
