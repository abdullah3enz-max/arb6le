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
    <nav className="flex items-center justify-between">
      <Link href="/dashboard" className="text-lg font-extrabold text-ink-900">
        اربط لي يا حب <span className="text-accent-500">❤️</span>
      </Link>
      <div className="flex items-center gap-4 text-sm font-semibold text-ink-600">
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
        <span className="text-ink-300">{userName}</span>
        <button onClick={logout} className="hover:text-accent-600">
          خروج
        </button>
      </div>
    </nav>
  );
}
