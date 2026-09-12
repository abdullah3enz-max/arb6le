import Link from 'next/link';
import { LandingDemo } from '@/components/LandingDemo';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center justify-between">
        <div className="text-lg font-extrabold text-ink-900">
          اربط لي يا حب <span className="text-accent-500">❤️</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-ink-600 hover:text-ink-900">
            تسجيل الدخول
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            ابدأ مجانًا
          </Link>
        </div>
      </nav>

      <section className="mx-auto mt-16 max-w-3xl text-center">
        <h1 className="animate-fade-up text-4xl font-extrabold leading-tight text-ink-900 md:text-5xl">
          اربطها بطريقة ما تنساها <span className="text-accent-500">❤️</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-600">
          ارفع سلايداتك، وخلنا نربط المعلومات بأشياء أنت تحبها — كرة القدم، مسلسلاتك، أفلامك،
          أنميك المفضل. بربط حقيقي ومنطقي، لا سواليف AI.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-full bg-accent-500 px-7 py-3 text-base font-bold text-white shadow-card transition hover:bg-accent-600"
          >
            ابدأ مجانًا
          </Link>
          <a
            href="#demo"
            className="rounded-full border border-ink-100 bg-white px-7 py-3 text-base font-bold text-ink-800 transition hover:bg-ink-50"
          >
            جرّب مثال
          </a>
        </div>
      </section>

      <section id="demo" className="mt-20">
        <h2 className="mb-6 text-center text-2xl font-bold text-ink-900">مثال حي على الربط</h2>
        <LandingDemo />
      </section>

      <section className="mt-24 grid gap-5 md:grid-cols-3">
        {[
          {
            emoji: '🔍',
            title: 'ربط حقيقي، لا اختراع',
            body: 'كل رابط يمر بمرحلة Fact-Checking و Critic مستقل قبل ما يوصلك. إذا ما وجدنا رابط قوي وصادق، نقولك بصراحة.'
          },
          {
            emoji: '🧠',
            title: 'مبني على اللي تحبه أنت',
            body: 'مسلسلاتك، أفلامك، فريقك، لاعبينك المفضلين — كل التخصيص من ملف ذاكرتك الشخصي.'
          },
          {
            emoji: '📈',
            title: 'يتحسن معك',
            body: 'كل ❤️ و👎 و🔄 يعلّم النظام أكثر عن أسلوبك المفضل بالحفظ.'
          }
        ].map((f) => (
          <div key={f.title} className="rounded-xl2 border border-ink-100 bg-white p-6 shadow-card">
            <div className="mb-2 text-2xl">{f.emoji}</div>
            <h3 className="mb-1 font-bold text-ink-900">{f.title}</h3>
            <p className="text-sm text-ink-600">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-24 border-t border-ink-100 py-8 text-center text-sm text-ink-400">
        اربط لي يا حب ❤️ — ERBOTLI · مصمم لطلاب الجامعات
      </footer>
    </main>
  );
}
