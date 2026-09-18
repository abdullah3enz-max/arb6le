'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TagInput } from '@/components/TagInput';
import { EntitySearchField } from '@/components/EntitySearchField';

const CATEGORY_META = {
  SERIES: { label: 'مسلسلات', emoji: '📺', from: 'from-sky-500/25' },
  MOVIES: { label: 'أفلام', emoji: '🎬', from: 'from-violet-500/25' },
  FOOTBALL: { label: 'رياضة', emoji: '⚽', from: 'from-emerald-500/25' },
  GAMES: { label: 'ألعاب', emoji: '🎮', from: 'from-indigo-500/25' },
  ANIME: { label: 'أنمي', emoji: '🍥', from: 'from-pink-500/25' },
  CARS: { label: 'سيارات', emoji: '🚗', from: 'from-orange-500/25' },
  MUSIC: { label: 'موسيقى', emoji: '🎵', from: 'from-teal-500/25' },
  PEOPLE: { label: 'مشاهير', emoji: '👤', from: 'from-rose-500/25' }
} as const;

const WORLD_OPTIONS = Object.entries(CATEGORY_META).map(([key, meta]) => ({ key: key as keyof typeof CATEGORY_META, ...meta }));

const STYLE_OPTIONS = [
  { key: 'fast', label: 'روابط سريعة', emoji: '⚡' },
  { key: 'funny', label: 'روابط مضحكة', emoji: '😂' },
  { key: 'smart', label: 'روابط ذكية', emoji: '🧠' },
  { key: 'visual', label: 'روابط بصرية', emoji: '🎬' },
  { key: 'phonetic', label: 'تشابه صوتي', emoji: '🔊' }
];

const SOFT_CAP = 8;
const MIN_WORLDS = 2;

interface FormState {
  worlds: string[];
  showTitles: string[];
  showChars: string[];
  showBits: string[];
  movieTitles: string[];
  movieChars: string[];
  animeTitles: string[];
  animeChars: string[];
  gameTitles: string[];
  gameChars: string[];
  cars: string[];
  music: string[];
  people: string[];
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
  animeTitles: [],
  animeChars: [],
  gameTitles: [],
  gameChars: [],
  cars: [],
  music: [],
  people: [],
  teams: [],
  nationalTeams: [],
  players: [],
  connectionStyles: []
};

interface SavedTitleWithChars {
  title: string;
  favoriteChars: string[];
  rememberedBits?: string[];
}

interface SavedPreferences {
  worlds: string[];
  connectionStyles: string[];
  shows: SavedTitleWithChars[];
  movies: SavedTitleWithChars[];
  anime: SavedTitleWithChars[];
  games: SavedTitleWithChars[];
  cars: string[];
  music: string[];
  people: string[];
  teams: string[];
  nationalTeams: string[];
  players: string[];
}

function collectChars(items: SavedTitleWithChars[]): string[] {
  return Array.from(new Set(items.flatMap((i) => i.favoriteChars)));
}

function countInterests(f: FormState): number {
  return (
    f.showTitles.length +
    f.movieTitles.length +
    f.animeTitles.length +
    f.gameTitles.length +
    f.cars.length +
    f.music.length +
    f.people.length +
    f.teams.length +
    f.nationalTeams.length +
    f.players.length
  );
}

/** Item 1-4, 15: a visual, playful onboarding — the user is building their profile, not
 *  filling a form. Also doubles as the "edit my preferences" screen for returning users. */
export function OnboardingWizard() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissedCap, setDismissedCap] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((saved: SavedPreferences | null) => {
        if (saved) {
          setForm({
            worlds: saved.worlds,
            showTitles: saved.shows.map((s) => s.title),
            showChars: collectChars(saved.shows),
            showBits: Array.from(new Set(saved.shows.flatMap((s) => s.rememberedBits ?? []))),
            movieTitles: saved.movies.map((m) => m.title),
            movieChars: collectChars(saved.movies),
            animeTitles: saved.anime.map((a) => a.title),
            animeChars: collectChars(saved.anime),
            gameTitles: saved.games.map((g) => g.title),
            gameChars: collectChars(saved.games),
            cars: saved.cars,
            music: saved.music,
            people: saved.people,
            teams: saved.teams,
            nationalTeams: saved.nationalTeams,
            players: saved.players,
            connectionStyles: saved.connectionStyles
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const steps = useMemo(() => {
    const dynamic: string[] = ['worlds'];
    for (const key of form.worlds) {
      if (key === 'SERIES') dynamic.push('series');
      if (key === 'MOVIES') dynamic.push('movies');
      if (key === 'ANIME') dynamic.push('anime');
      if (key === 'GAMES') dynamic.push('games');
      if (key === 'CARS') dynamic.push('cars');
      if (key === 'MUSIC') dynamic.push('music');
      if (key === 'PEOPLE') dynamic.push('people');
      if (key === 'FOOTBALL') dynamic.push('football');
    }
    dynamic.push('style', 'ready');
    return dynamic;
  }, [form.worlds]);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const worldsBelowMin = step === 'worlds' && form.worlds.length < MIN_WORLDS;
  const interestCount = countInterests(form);
  const showCapBanner = interestCount >= SOFT_CAP && !dismissedCap && step !== 'style' && step !== 'ready' && step !== 'worlds';

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
          anime: form.animeTitles.map((title) => ({ title, favoriteChars: form.animeChars })),
          games: form.gameTitles.map((title) => ({ title, favoriteChars: form.gameChars })),
          cars: form.cars,
          music: form.music,
          people: form.people,
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
    if (worldsBelowMin) return;
    if (isLast) finish();
    else setStepIndex((i) => i + 1);
  }

  function jumpToStyle() {
    setStepIndex(steps.indexOf('style'));
  }

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
        <p className="text-sm text-ink-400">جاري التحميل...</p>
      </main>
    );
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
            className="h-full rounded-full bg-accent-500 transition-all duration-500"
            style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {showCapBanner && (
        <div className="animate-fade-up mb-4 flex items-center justify-between gap-3 rounded-xl2 border border-accent-200 bg-accent-50 px-4 py-3">
          <p className="text-sm font-semibold text-accent-700">ممتاز، صار عندنا ما يكفي لصناعة روابطك 🧠</p>
          <button onClick={jumpToStyle} className="shrink-0 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold text-white">
            كمّل الحين
          </button>
          <button onClick={() => setDismissedCap(true)} className="shrink-0 text-xs font-semibold text-ink-500 hover:text-ink-700">
            أضيف أكثر
          </button>
        </div>
      )}

      {step === 'worlds' && (
        <StepShell title="خلنا نعرف وش تحب ❤️" subtitle="كل ما عرفناك أكثر، قدرنا نربط لك المعلومة بطريقة تثبت في راسك.">
          <p className="mb-3 text-sm font-semibold text-ink-700">وش تحب؟</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                    'group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border p-4 text-sm font-semibold transition-colors duration-200 ' +
                    (checked ? 'border-accent-500 shadow-glow' : 'border-ink-100 hover:border-ink-200')
                  }
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${opt.from} to-transparent opacity-70`} />
                  <span className="relative text-3xl">{opt.emoji}</span>
                  <span className="relative text-ink-900">{opt.label}</span>
                  {checked && <span className="absolute left-2 top-2 text-accent-500">✓</span>}
                </button>
              );
            })}
          </div>
          <p className={'mt-3 text-xs font-semibold ' + (worldsBelowMin ? 'text-accent-500' : 'text-ink-400')}>
            {form.worlds.length === 0
              ? `اختر ${MIN_WORLDS} على الأقل عشان نكمل.`
              : worldsBelowMin
                ? `اختر واحد ثاني على الأقل (${form.worlds.length}/${MIN_WORLDS}).`
                : `تمام، اخترت ${form.worlds.length}.`}
          </p>
        </StepShell>
      )}

      {step === 'series' && (
        <StepShell title="وش المسلسلات اللي تحبها؟ 📺" subtitle="اختر الأشياء اللي فعلًا تعرفها — اكتب واضغط Enter.">
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
        <StepShell title="وش الأفلام اللي تحبها؟ 🎬" subtitle="أفلام، ممثلين، مخرجين، أو شخصيات.">
          <Field label="الأفلام">
            <TagInput values={form.movieTitles} onChange={(v) => setForm((f) => ({ ...f, movieTitles: v }))} placeholder="مثلاً: Interstellar" />
          </Field>
          <Field label="ممثلين / مخرجين / شخصيات (اختياري)">
            <TagInput values={form.movieChars} onChange={(v) => setForm((f) => ({ ...f, movieChars: v }))} placeholder="مثلاً: Leonardo DiCaprio" />
          </Field>
        </StepShell>
      )}

      {step === 'anime' && (
        <StepShell title="وش الأنمي اللي تحبه؟ 🍥" subtitle="ابحث وراح تطلع لك نتائج حقيقية بصورها.">
          <Field label="الأنمي">
            <EntitySearchField
              endpoint="/api/search/anime"
              placeholder="ابحث عن أنمي... مثلاً One Piece"
              selected={form.animeTitles}
              onChange={(v) => setForm((f) => ({ ...f, animeTitles: v }))}
            />
          </Field>
          <Field label="وش الشخصيات اللي تحبها؟ (اختياري)">
            <TagInput values={form.animeChars} onChange={(v) => setForm((f) => ({ ...f, animeChars: v }))} placeholder="مثلاً: Itachi" />
          </Field>
        </StepShell>
      )}

      {step === 'games' && (
        <StepShell title="وش الألعاب اللي تحبها؟ 🎮" subtitle="اكتب اسم اللعبة، وتقدر تضيف أكثر من واحدة.">
          <Field label="الألعاب">
            <TagInput values={form.gameTitles} onChange={(v) => setForm((f) => ({ ...f, gameTitles: v }))} placeholder="مثلاً: GTA V" />
          </Field>
          <Field label="شخصيات / أسلحة / عناصر مشهورة (اختياري)">
            <TagInput values={form.gameChars} onChange={(v) => setForm((f) => ({ ...f, gameChars: v }))} placeholder="مثلاً: Kratos" />
          </Field>
        </StepShell>
      )}

      {step === 'cars' && (
        <StepShell title="وش السيارات اللي تحبها؟ 🚗" subtitle="شركات، موديلات، أو أرقام مرتبطة فيها.">
          <Field label="السيارات">
            <TagInput values={form.cars} onChange={(v) => setForm((f) => ({ ...f, cars: v }))} placeholder="مثلاً: Nissan GT-R" />
          </Field>
        </StepShell>
      )}

      {step === 'music' && (
        <StepShell title="وش الموسيقى اللي تحبها؟ 🎵" subtitle="ابحث عن فنان وراح تطلع لك نتائج حقيقية بصورها.">
          <Field label="فنانين">
            <EntitySearchField
              endpoint="/api/search/music"
              placeholder="ابحث عن فنان..."
              selected={form.music}
              onChange={(v) => setForm((f) => ({ ...f, music: v }))}
            />
          </Field>
        </StepShell>
      )}

      {step === 'people' && (
        <StepShell title="وش الشخصيات اللي تحبها؟ 👤" subtitle="أي شخصية عامة — ابحث عنها وراح تطلع لك.">
          <Field label="شخصيات">
            <EntitySearchField
              endpoint="/api/search/people"
              placeholder="ابحث عن أي شخصية..."
              selected={form.people}
              onChange={(v) => setForm((f) => ({ ...f, people: v }))}
            />
          </Field>
        </StepShell>
      )}

      {step === 'football' && (
        <StepShell title="رياضة ⚽" subtitle="فرقك، منتخبك، ولاعبينك المفضلين.">
          <Field label="وش الفرق اللي تشجعها؟">
            <TagInput values={form.teams} onChange={(v) => setForm((f) => ({ ...f, teams: v }))} placeholder="مثلاً: Al Hilal" />
          </Field>
          <Field label="وش المنتخبات اللي تتابعها؟ (اختياري)">
            <TagInput values={form.nationalTeams} onChange={(v) => setForm((f) => ({ ...f, nationalTeams: v }))} placeholder="مثلاً: السعودية" />
          </Field>
          <Field label="وش اللاعبين اللي تحبهم؟ (اختياري)">
            <TagInput values={form.players} onChange={(v) => setForm((f) => ({ ...f, players: v }))} placeholder="مثلاً: Cristiano Ronaldo" />
          </Field>
        </StepShell>
      )}

      {step === 'style' && (
        <StepShell title="كيف تحب نتعلم؟ 🧠" subtitle="اختر أكثر من واحد — نتعلم أسلوبك أكثر كل ما استخدمت المنصة.">
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
                    'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ' +
                    (checked ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-ink-100 bg-surface text-ink-700 hover:bg-ink-100')
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

      {step === 'ready' && (
        <StepShell title="جاهز؟ 🚀" subtitle="">
          <p className="text-center text-ink-700">
            الآن نعرف الأشياء اللي تحبها.
            <br />
            ارفع أول ملف، ونحن نربط المعلومات بأشياء تعرفها.
          </p>
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
          disabled={submitting || worldsBelowMin}
          className="rounded-full bg-accent-500 px-8 py-3 text-sm font-bold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast ? (submitting ? 'جاري الحفظ...' : 'ابدأ التعلم →') : 'التالي'}
        </button>
      </div>
    </main>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up rounded-xl2 border border-ink-100 bg-surface p-6 shadow-card">
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
