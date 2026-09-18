import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  // Tajawal doesn't ship a 600 weight at all (only 200/300/400/500/700/800/900 exist) — so
  // `font-semibold` (Tailwind's default weight-600 utility, used 70+ times across the app) was
  // never able to load a matching file and always fell back to the browser's nearest-weight
  // guess. Fixed properly in tailwind.config.ts by remapping `semibold` to 500, an actual loaded
  // weight — this only loads weights that exist and are used, nothing wasted either way.
  weight: ['400', '500', '700', '800'],
  variable: '--font-arabic'
});

export const metadata: Metadata = {
  title: 'اربط لي يا حب ❤️ — ERBOTLI',
  description: 'نربط معلومات سلايداتك بالأشياء اللي تحبها، بربط حقيقي يثبت في راسك.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="min-h-screen bg-ink-50 font-arabic text-ink-900 antialiased">{children}</body>
    </html>
  );
}
