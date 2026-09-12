import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google';
import './globals.css';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
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
