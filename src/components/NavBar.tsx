'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function NavBar({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const initial = userName.trim().charAt(0).toUpperCase() || '؟';

  const links = [
    { href: '/onboarding', label: 'تفضيلاتي' },
    { href: '/study', label: 'Study Mode' },
    { href: '/plans', label: 'الخطط' },
    ...(isAdmin ? [{ href: '/admin', label: 'الإدارة' }] : [])
  ];

  return (
    <nav className="glass relative rounded-3xl border border-ink-100 px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/dashboard" className="shrink-0 whitespace-nowrap text-base font-extrabold text-ink-900 sm:text-lg">
          اربط لي يا حب <span className="text-accent-500">❤️</span>
        </Link>

        <div className="hidden items-center gap-4 text-sm font-semibold text-ink-600 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink-900">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div ref={accountRef} className="relative hidden md:block">
            <button
              onClick={() => setAccountOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-white transition hover:bg-accent-600"
              aria-label="حساب المستخدم"
            >
              {initial}
            </button>
            {accountOpen && (
              <div className="absolute left-0 z-20 mt-2 w-52 rounded-xl2 border border-ink-100 bg-surface p-2 shadow-card animate-fade-up">
                <p className="truncate px-3 py-1.5 text-xs text-ink-400">{userName}</p>
                <Link
                  href="/account"
                  onClick={() => setAccountOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                >
                  ⚙️ إعدادات الحساب
                </Link>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm font-semibold text-accent-600 hover:bg-ink-50"
                >
                  🚪 خروج
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-1.5 text-xl leading-none text-ink-600 hover:text-ink-900 md:hidden"
            aria-label="فتح القائمة"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="animate-fade-up mt-3 space-y-1 border-t border-ink-100 pt-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/account"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
              {initial}
            </span>
            <span className="truncate">{userName} — الإعدادات</span>
          </Link>
          <button
            onClick={logout}
            className="block w-full rounded-lg px-3 py-2.5 text-right text-sm font-semibold text-accent-600 hover:bg-ink-50"
          >
            🚪 خروج
          </button>
        </div>
      )}
    </nav>
  );
}
