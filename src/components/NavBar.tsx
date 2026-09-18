'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function NavBar({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="glass flex items-center justify-between rounded-full border border-ink-100 px-5 py-3">
      <Link href="/dashboard" className="text-lg font-extrabold text-ink-900">
        اربط لي يا حب <span className="text-accent-500">❤️</span>
      </Link>
      <div className="flex items-center gap-4 text-sm font-semibold text-ink-600">
        <Link href="/onboarding" className="hover:text-ink-900">
          تفضيلاتي
        </Link>
        <Link href="/study" className="hover:text-ink-900">
          Study Mode
        </Link>
        <Link href="/plans" className="hover:text-ink-900">
          الخطط
        </Link>
        {isAdmin && (
          <Link href="/admin" className="hover:text-ink-900">
            الإدارة
          </Link>
        )}
        <span className="text-ink-500">{userName}</span>
        <button onClick={logout} className="hover:text-accent-500">
          خروج
        </button>
      </div>
    </nav>
  );
}
