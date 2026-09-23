import Link from 'next/link';
import { LandingDemo } from '@/components/LandingDemo';
import { BridgeHero } from '@/components/BridgeHero';
import { TiltCard } from '@/components/TiltCard';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

const FEATURES = [
  {
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M20 20l-4.4-4.4" />
        <path d="M8 10.5l1.6 1.6L13.5 8" />
      </svg>
    ),
    title: 'ربط حقيقي بس، ولا اختراع',
    body: 'كل ربط يمر بفحص حقائق ونقد مستقل قبل يوصلك. ما لقينا ربط قوي وصادق؟ نقولك على طول، بدون لف ودوران.'
  },
  {
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 20.5s-8-4.7-8-11a4.7 4.7 0 0 1 8-3.3A4.7 4.7 0 0 1 20 9.5c0 6.3-8 11-8 11z" />
        <path d="M12 6.3v3.4M10.3 8h3.4" />
      </svg>
    ),
    title: 'مبني على اللي تحبه إنت',
    body: 'مسلسلاتك، أفلامك، فريقك، لاعبينك المفضلين — كله يدخل بملف ذاكرتك الشخصي.'
  },
  {
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 17l5.2-5.6 3.6 3 6.2-7" />
        <path d="M14.4 6.4H19v4.7" />
      </svg>
    ),
    title: 'يتطوّر معاك أول بأول',
    body: 'كل ❤️ و👎 و🔄 يعلّمنا أكثر عن طريقتك المفضلة بالحفظ.'
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <nav className="glass sticky top-0 z-20 border-b border-ink-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-extrabold text-ink-900">
            اربط لي يا حب <span className="text-accent-500">❤️</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-ink-600 hover:text-ink-900">
              تسجيل الدخول
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
            >
              ابدأ مجانًا
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative">
        <div className="bg-line-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 pb-8 pt-20 text-center md:pt-28">
          <div className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-1.5 text-xs font-bold uppercase text-ink-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-500" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-accent-500" />
            </span>
            Personalized Memory Engine
          </div>
          <h1 className="animate-fade-up text-balance text-5xl font-extrabold leading-[1.05] tracking-tight text-ink-900 md:text-7xl lg:text-8xl">
            اربطها بطريقة
            <br />
            <span className="text-accent-500">ما تنساها</span> ❤️
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-ink-600">
            "10 mg" ما تنساها إذا صارت "Messi = 10". ارفع سلايداتك، وخل الذكاء الاصطناعي يسوي لك
            أقصر رابط ممكن بين كل معلومة صعبة وشيء تعرفه وتحبه من جد — مو شرح طويل، بس جسر واحد
            يُفهم من أول نظرة.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-full bg-accent-500 px-8 py-3.5 text-base font-bold text-white shadow-glow transition duration-200 hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-[0_20px_50px_-12px_rgba(255,59,76,0.55)]"
            >
              ابدأ مجانًا
            </Link>
            <a
              href="#demo"
              className="rounded-full border border-ink-200 bg-surface px-8 py-3.5 text-base font-bold text-ink-800 transition duration-200 hover:-translate-y-0.5 hover:border-ink-300"
            >
              جرّب مثال
            </a>
          </div>
          <p className="mt-4 text-xs text-ink-500">بدون بطاقة ائتمان · يبدأ مجانًا فورًا</p>

          <BridgeHero />
        </div>
      </section>

      <section id="demo" className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow mb-2 text-center text-xs font-bold uppercase text-accent-500">Live Example</p>
        <h2 className="mb-10 text-center text-3xl font-extrabold text-ink-900">شوف مثال حي على الربط</h2>
        <LandingDemo />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <TiltCard key={f.title} maxTilt={6}>
              <div className="group h-full rounded-xl2 border border-ink-100 bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-accent-300/40 hover:shadow-glow">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-500 transition-colors duration-300 group-hover:bg-accent-100">
                  {f.icon}
                </div>
                <h3 className="mb-1.5 font-bold text-ink-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ink-600">{f.body}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-100 py-10 text-center text-sm text-ink-500">
        اربط لي يا حب ❤️ — ERBOTLI · مصمم لطلاب الجامعات
      </footer>
    </main>
  );
}
