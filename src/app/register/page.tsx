'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل إنشاء الحساب.');
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <h1 className="mb-1 text-2xl font-extrabold text-ink-900">أنشئ حسابك ❤️</h1>
      <p className="mb-6 text-sm text-ink-500">دقيقة واحدة، وبعدها نتعرف عليك.</p>

      <form onSubmit={onSubmit} className="w-full space-y-4">
        <input
          required
          placeholder="اسمك"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm outline-none focus:border-accent-500"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          type="email"
          placeholder="بريدك الإلكتروني"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm outline-none focus:border-accent-500"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="كلمة المرور (8 أحرف فأكثر)"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm outline-none focus:border-accent-500"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-sm text-accent-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? '...' : 'ابدأ مجانًا'}
        </button>
      </form>

      <p className="mt-5 text-sm text-ink-500">
        عندك حساب؟{' '}
        <Link href="/login" className="font-semibold text-accent-600">
          سجّل دخولك
        </Link>
      </p>
    </main>
  );
}
