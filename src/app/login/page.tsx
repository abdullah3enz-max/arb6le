'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'فشل تسجيل الدخول.');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-ink-900">هلا فيك مرة ثانية 👋</h1>
      <form onSubmit={onSubmit} className="w-full space-y-4">
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
          placeholder="كلمة المرور"
          className="w-full rounded-xl border border-ink-100 px-4 py-3 text-sm outline-none focus:border-accent-500"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-sm text-accent-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {loading ? '...' : 'تسجيل الدخول'}
        </button>
      </form>
      <p className="mt-5 text-sm text-ink-500">
        أول مرة؟{' '}
        <Link href="/register" className="font-semibold text-accent-600">
          أنشئ حساب
        </Link>
      </p>
    </main>
  );
}
