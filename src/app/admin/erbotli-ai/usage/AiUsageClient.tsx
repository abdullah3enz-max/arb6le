'use client';

import { useEffect, useState } from 'react';

interface ModelStats {
  model: string;
  count: number;
  costCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgLatencyMs: number;
  failedCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  isCurrentFast: boolean;
  isCurrentStrong: boolean;
}

interface AiUsageData {
  currentModels: {
    provider: string;
    fast: { model: string; stats: ModelStats | null };
    strong: { model: string; stats: ModelStats | null };
  };
  totalRequests: number;
  requestsToday: number;
  requestsThisMonth: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  avgLatencyMs: number;
  failedGenerations: number;
  failureRate: number;
  cacheHitRate: number;
  byAgent: { agent: string; count: number; costCents: number; avgLatencyMs: number }[];
  topUsers: { userId: string; email: string; name: string | null; count: number; costCents: number }[];
  byModel: ModelStats[];
  dailyTrend: { date: string; count: number; costCents: number; failed: number }[];
}

const AGENT_LABEL: Record<string, string> = {
  concept_extractor: '🧠 استخراج المفاهيم',
  connection_finder: '🔗 البحث عن الروابط',
  knowledge_mapper: '🧩 ربط المفاهيم ببعضها',
  connection_critic: '🕵️ نقد الروابط',
  quiz_generator: '📝 توليد الاختبارات'
};

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic مباشر',
  openai_compatible: 'متوافق مع OpenAI (OpenRouter أو مشابه)',
  mock: '⚠️ وضع تجريبي (Mock) — بدون مفتاح API حقيقي'
};

function fmtNumber(n: number) {
  return n.toLocaleString('ar-SA');
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('ar-SA') : null;
}

export function AiUsageClient() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/ai-usage')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)));
  }, []);

  if (error) return <p className="text-sm font-semibold text-accent-600">{error}</p>;
  if (!data) return <p className="text-sm text-ink-400">جاري التحميل...</p>;

  const maxAgentCount = Math.max(1, ...data.byAgent.map((a) => a.count));
  const maxTrendCount = Math.max(1, ...data.dailyTrend.map((d) => d.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">استخدام الذكاء الاصطناعي</h1>
        <p className="mt-1 text-sm text-ink-500">
          كل رقم هنا من جدول AiGeneration الحقيقي — كل استدعاء LLM (ناجح، فاشل، أو من الكاش) يُسجَّل هناك.
        </p>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400">الموديل المستخدم الآن</h3>
          <span className="text-xs font-semibold text-ink-400">
            المزوّد: <span className="text-ink-700">{PROVIDER_LABEL[data.currentModels.provider] ?? data.currentModels.provider}</span>
          </span>
        </div>
        <p className="mb-3 text-xs text-ink-400">
          مقروء مباشرة من إعدادات البيئة الحالية (env vars) — أي تغيير بالموديل بالاستضافة ينعكس هنا تلقائيًا،
          وأي موديل نستخدمه بالمستقبل بيظهر بجدول &quot;مقارنة الموديلات&quot; تحت بمجرد أول استدعاء له.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModelCard label="⚡ السريع (Fast tier)" sub="استخراج المفاهيم، ربط المفاهيم، توليد الاختبارات" model={data.currentModels.fast.model} stats={data.currentModels.fast.stats} />
          <ModelCard label="🧠 القوي (Strong tier)" sub="البحث عن الروابط، نقد الروابط" model={data.currentModels.strong.model} stats={data.currentModels.strong.stats} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">الحجم</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="إجمالي الطلبات" value={fmtNumber(data.totalRequests)} />
          <Stat label="طلبات اليوم" value={fmtNumber(data.requestsToday)} />
          <Stat label="طلبات هذا الشهر" value={fmtNumber(data.requestsThisMonth)} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">التكلفة والأداء</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="التكلفة التقديرية (دولار)" value={(data.totalCostCents / 100).toFixed(2)} />
          <Stat label="توكنز الإدخال" value={fmtNumber(data.totalInputTokens)} />
          <Stat label="توكنز الإخراج" value={fmtNumber(data.totalOutputTokens)} />
          <Stat label="متوسط زمن التوليد" value={`${fmtNumber(data.avgLatencyMs)} ms`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">الموثوقية</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="عمليات فاشلة"
            value={`${fmtNumber(data.failedGenerations)} (${(data.failureRate * 100).toFixed(1)}%)`}
            tone={data.failedGenerations > 0 ? 'warn' : undefined}
          />
          <Stat label="نسبة الاستفادة من الكاش" value={`${(data.cacheHitRate * 100).toFixed(1)}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">الطلبات آخر 14 يوم</h2>
        <div className="rounded-xl2 border border-ink-100 bg-surface p-5">
          <div className="flex h-32 gap-1.5">
            {data.dailyTrend.map((d) => (
              // items-end on the row wouldn't stretch these flex-1 children to the row's full
              // height, so a percentage height on the bar inside had no real height to resolve
              // against and silently rendered as 0. flex-col + justify-end here does the same
              // "sits at the bottom" job while the wrapper genuinely fills h-32.
              <div key={d.date} className="group relative flex flex-1 flex-col justify-end">
                <div
                  className={'w-full rounded-t ' + (d.failed > 0 ? 'bg-accent-300' : 'bg-accent-500')}
                  style={{ height: `${Math.max(2, (d.count / maxTrendCount) * 100)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full right-1/2 z-10 mb-1 hidden translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-2 py-1 text-[10px] text-ink-50 group-hover:block">
                  {d.date}: {d.count} طلب{d.failed > 0 ? ` (${d.failed} فاشل)` : ''}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink-400">
            <span>{data.dailyTrend[0]?.date}</span>
            <span>{data.dailyTrend[data.dailyTrend.length - 1]?.date}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">مقارنة الموديلات</h2>
        <p className="mb-3 text-xs text-ink-400">كل موديل استُخدم من قبل — الحالي منها مؤشّر بشارة، والباقي سجل تاريخي.</p>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">الموديل</th>
                <th className="px-4 py-2 text-right">عدد الطلبات</th>
                <th className="px-4 py-2 text-right">توكنز (إدخال ← إخراج)</th>
                <th className="px-4 py-2 text-right">التكلفة (دولار)</th>
                <th className="px-4 py-2 text-right">متوسط الزمن</th>
                <th className="px-4 py-2 text-right">فاشلة</th>
                <th className="px-4 py-2 text-right">أول / آخر استخدام</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-400">
                    ما فيه استدعاءات مسجّلة بعد.
                  </td>
                </tr>
              )}
              {data.byModel.map((m) => (
                <tr key={m.model} className="border-t border-ink-100">
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-ink-800">{m.model}</span>
                      {m.isCurrentFast && <Badge>حالي · سريع</Badge>}
                      {m.isCurrentStrong && <Badge>حالي · قوي</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-ink-500">{fmtNumber(m.count)}</td>
                  <td dir="ltr" className="px-4 py-2 text-ink-500">
                    {fmtNumber(m.totalInputTokens)} ← {fmtNumber(m.totalOutputTokens)}
                    <span className="mr-1 text-ink-300">(متوسط {fmtNumber(m.avgInputTokens)}←{fmtNumber(m.avgOutputTokens)})</span>
                  </td>
                  <td className="px-4 py-2 text-ink-500">${(m.costCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-ink-500">{fmtNumber(m.avgLatencyMs)}ms</td>
                  <td className={'px-4 py-2 ' + (m.failedCount > 0 ? 'text-accent-600' : 'text-ink-500')}>{m.failedCount}</td>
                  <td className="px-4 py-2 text-xs text-ink-400">
                    {fmtDate(m.firstUsedAt)} — {fmtDate(m.lastUsedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">الاستخدام حسب الوكيل (Agent)</h2>
        <div className="space-y-3 rounded-xl2 border border-ink-100 bg-surface p-5">
          {data.byAgent.length === 0 && <p className="text-sm text-ink-400">ما فيه بيانات بعد.</p>}
          {data.byAgent.map((a) => (
            <div key={a.agent}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-800">{AGENT_LABEL[a.agent] ?? a.agent}</span>
                <span className="text-xs text-ink-400">
                  {fmtNumber(a.count)} طلب · ${(a.costCents / 100).toFixed(2)} · {fmtNumber(a.avgLatencyMs)}ms
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-accent-500"
                  style={{ width: `${(a.count / maxAgentCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink-900">أكثر المستخدمين استهلاكًا للتكلفة</h2>
        <div className="overflow-x-auto rounded-xl2 border border-ink-100 bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-ink-500">
              <tr>
                <th className="px-4 py-2 text-right">المستخدم</th>
                <th className="px-4 py-2 text-right">عدد الطلبات</th>
                <th className="px-4 py-2 text-right">التكلفة (دولار)</th>
              </tr>
            </thead>
            <tbody>
              {data.topUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-ink-400">
                    ما فيه بيانات بعد.
                  </td>
                </tr>
              )}
              {data.topUsers.map((u) => (
                <tr key={u.userId} className="border-t border-ink-100">
                  <td className="px-4 py-2 text-ink-800">{u.name ?? u.email}</td>
                  <td className="px-4 py-2 text-ink-500">{fmtNumber(u.count)}</td>
                  <td className="px-4 py-2 text-ink-500">${(u.costCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={'mt-1 text-lg font-extrabold ' + (tone === 'warn' ? 'text-accent-600' : 'text-ink-900')}>{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-600">{children}</span>;
}

function ModelCard({ label, sub, model, stats }: { label: string; sub: string; model: string; stats: ModelStats | null }) {
  return (
    <div className="rounded-xl2 border border-accent-200/50 bg-surface p-4 shadow-card">
      <p className="text-xs font-bold text-ink-400">{label}</p>
      <p className="mt-1 break-all font-mono text-sm font-extrabold text-ink-900">{model}</p>
      <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>

      {stats ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-xs">
          <div>
            <p className="text-ink-400">مستخدم منذ</p>
            <p className="font-semibold text-ink-800">{fmtDate(stats.firstUsedAt)}</p>
          </div>
          <div>
            <p className="text-ink-400">عدد الطلبات</p>
            <p className="font-semibold text-ink-800">{fmtNumber(stats.count)}</p>
          </div>
          <div>
            <p className="text-ink-400">متوسط زمن الاستجابة</p>
            <p className="font-semibold text-ink-800">{fmtNumber(stats.avgLatencyMs)}ms</p>
          </div>
          <div>
            <p className="text-ink-400">متوسط توكنز (إدخال ← إخراج)</p>
            <p dir="ltr" className="font-semibold text-ink-800">
              {fmtNumber(stats.avgInputTokens)} ← {fmtNumber(stats.avgOutputTokens)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
          ما استُخدم أي استدعاء فعلي بهذا الموديل بعد — بيظهر أداءه هنا أول ما يُستخدم.
        </p>
      )}
    </div>
  );
}
