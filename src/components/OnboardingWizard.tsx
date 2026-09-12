'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TagInput } from '@/components/TagInput';

const WORLD_OPTIONS = [
  { key: 'SERIES', label: 'مسلسلات', emoji: '📺' },
  { key: 'MOVIES', label: 'أفلام', emoji: '🎬' },
  { key: 'FOOTBALL', label: 'كرة القدم', emoji: '⚽' },
  { key: 'GAMES', label: 'ألعاب', emoji: '🎮' },
  { key: 'ANIME', label: 'أنمي', emoji: '🇯🇵' },
  { key: 'CHARACTERS', label: 'شخصيات', emoji: '🦸' },
  { key: 'BOOKS', label: 'كتب', emoji: '📚' },
  { key: 'DAILY_LIFE', label: 'الحياة اليومية', emoji: '☀️' }
] as const;

const STYLE_OPTIONS = [
  { key: 'stories', label: 'قصص' },
  { key: 'characters', label: 'شخصيات' },
  { key: 'events', label: 'أحداث' },
  { key: 'cause_effect', label: 'سبب ونتيجة' },
  { key: 'comparisons', label: 'مقارنات' },
  { key: 'visual', label: 'تصور بصري' }
];

interface FormState {
  worlds: string[];
  showTitles: string[];
  showChars: string[];
  showBits: string[];
  movieTitles: string[];
  movieChars: string[];
  teams: string[];
  nationalTeams: string[];
  players: string[];
  connectionStyles: string[];
}

const EMPTY: FormState = {
  worlds: [],
  showTitles: [],
  showChars: [],
  showBits: [],
  movieTitles: [],
  movieChars: [],
  teams: [],
  nationalTeams: [],
  players: [],
  connectionStyles: []
};

export function OnboardingWizard() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Steps are built dynamically from what the user picked in step 0 — "لا تجعل العملية طويلة
  // ومملة" (item 5): a user who only picked football never sees the series/movies questions.
  const steps = useMemo(() => {
    const dynamic: string[] = ['worlds'];
    if (form.worlds.includes('SERIES')) dynamic.push('series');
    if (form.worlds.includes('MOVIES')) dynamic.push('movies');
    if (form.worlds.includes('FOOTBALL')) dynamic.push('football');
    dynamic.push('style');
    return dynamic;
  }, [form.worlds]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  async function finish() {
    setSubmitting(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          worlds: form.worlds,
          connectionStyles: form.connectionStyles,
          shows: form.showTitles.map((title) => ({ title, favoriteChars: form.showChars, rememberedBits: form.showBits })),
          movies: form.movieTitles.map((title) => ({ title, favoriteChars: form.movieChars })),
          teams: form.teams,
          nationalTeams: form.nationalTeams,
          players: form.players
        })
      });
      router.push('/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (isLast) finish();
    else setStepIndex((i) => i + 1);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-400">
          <span>
            {stepIndex + 1} / {steps.length}
          </span>
          <button onClick={() => router.push('/dashboard')} className="hover:text-ink-700">
            تخطي كل الأسئلة
          </button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 'worlds' && (
        <StepShell title="خلنا نعرف وش تحب ❤️" subtitle="كل ما عرفناك أكثر، قدرنا نربط لك المعلومة بطريقة تثبت في راسك.">
          <p className="mb-3 text-sm font-semibold text-ink-700">وش نوع الربط اللي تبيه؟</p>
          <div className="grid grid-cols-2 gap-3">
            {WORLD_OPTIONS.map((opt) => {
              const checked = form.worlds.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      worlds: checked ? f.worlds.filter((w) => w !== opt.key) : [...f.worlds, opt.key]
                    }))
                  }
                  className={
                    'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ' +
                    (checked ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-ink-100 bg-white text-ink-700 hover:bg-ink-50')
                  }
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {step === 'series' && (
        <StepShell title="وش المسلسلات اللي تحبها؟" subtitle="اكتب اسم المسلسل واضغط Enter — تقدر تضيف أكثر من واحد.">
          <Field label="المسلسلات">
            <TagInput values={form.showTitles} onChange={(v) => setForm((f) => ({ ...f, showTitles: v }))} placeholder="مثلاً: Breaking Bad" />
          </Field>
          <Field label="وش الشخصيات اللي تحبها؟ (اختياري)">
            <TagInput values={form.showChars} onChange={(v) => setForm((f) => ({ ...f, showChars: v }))} placeholder="مثلاً: Walter White" />
          </Field>
          <Field label="وش الأشياء اللي تتذكرها من المسلسل؟ (اختياري)">
            <TagInput values={form.showBits} onChange={(v) => setForm((f) => ({ ...f, showBits: v }))} placeholder="مثلاً: تحوّله لطابخ مخدرات" />
          </Field>
        </StepShell>
      )}

      {step === 'movies' && (
        <StepShell title="وش الأفلام اللي تحبها؟" subtitle="نفس الفكرة، وتقدر تختار أكثر من فيلم.">
          <Field label="الأفلام">
            <TagInput values={form.movieTitles} onChange={(v) => setForm((f) => ({ ...f, movieTitles: v }))} placeholder="مثلاً: Interstellar" />
          </Field>
          <Field label="وش الشخصيات أو العوالم اللي تفضلها؟ (اختياري)">
            <TagInput values={form.movieChars} onChange={(v) => setForm((f) => ({ ...f, movieChars: v }))} placeholder="مثلاً: Cooper" />
          </Field>
        </StepShell>
      )}

      {step === 'football' && (
        <StepShell title="كرة القدم ⚽" subtitle="فرقك، منتخبك، ولاعبينك المفضلين.">
          <Field label="وش الفرق اللي تشجعها؟">
            <TagInput values={form.teams} onChange={(v) => setForm((f) => ({ ...f, teams: v }))} placeholder="مثلاً: Al Hilal" />
          </Field>
          <Field label="وش المنتخبات اللي تتابعها؟ (اختياري)">
            <TagInput values={form.nationalTeams} onChange={(v) => setForm((f) => ({ ...f, nationalTeams: v }))} placeholder="مثلاً: السعودية" />
          </Field>
          <Field label="وش اللاعبين اللي تحبهم؟ (اختياري)">
            <TagInput values={form.players} onChange={(v) => setForm((f) => ({ ...f, players: v }))} placeholder="مثلاً: Salem Al-Dawsari" />
          </Field>
        </StepShell>
      )}

      {step === 'style' && (
        <StepShell title="آخر سؤال" subtitle="وش طريقة الربط اللي تفضّلها للحفظ؟ (اختياري، ونتعلم أسلوبك أكثر كل ما استخدمت المنصة)">
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((opt) => {
              const checked = form.connectionStyles.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      connectionStyles: checked
                        ? f.connectionStyles.filter((s) => s !== opt.key)
                        : [...f.connectionStyles, opt.key]
                    }))
                  }
                  className={
                    'rounded-full border px-4 py-2 text-sm font-semibold transition ' +
                    (checked ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-ink-100 bg-white text-ink-700 hover:bg-ink-50')
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          className="text-sm font-semibold text-ink-500 disabled:opacity-0"
        >
          رجوع
        </button>
        <button
          onClick={next}
          disabled={submitting}
          className="rounded-full bg-ink-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {isLast ? (submitting ? 'جاري الحفظ...' : 'ننطلق 🚀') : 'التالي'}
        </button>
      </div>
    </main>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
      <h1 className="mb-1 text-xl font-extrabold text-ink-900">{title}</h1>
      {subtitle && <p className="mb-5 text-sm text-ink-500">{subtitle}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</label>
      {children}
    </div>
  );
}
