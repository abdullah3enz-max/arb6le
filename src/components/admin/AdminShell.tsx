'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ADMIN_NAV } from '@/lib/admin/navConfig';
import type { PermissionKey } from '@/lib/rbac/permissions';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';

const ROLE_LABEL_AR: Record<string, string> = {
  OWNER: 'المالك',
  ADMIN: 'مدير',
  SUPPORT: 'الدعم',
  SALES: 'المبيعات',
  FINANCE: 'المالية',
  ANALYST: 'محلل'
};

const THEME_KEY = 'erbotli_admin_theme';

export function AdminShell({
  userName,
  role,
  permissions,
  children
}: {
  userName: string;
  role: string;
  permissions: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  const perms = new Set(permissions);
  const canSee = (p: PermissionKey | null) => p === null || perms.has(p);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div data-admin-theme={theme} className="flex min-h-screen bg-ink-50 text-ink-900">
      {/* Sidebar (desktop) */}
      <aside
        className={
          'sticky top-0 hidden h-screen shrink-0 flex-col border-l border-ink-100 bg-surface transition-all md:flex ' +
          (collapsed ? 'w-[76px]' : 'w-64')
        }
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-4">
          {!collapsed && (
            <Link href="/admin" className="text-sm font-extrabold text-ink-900">
              ERBOTLI <span className="text-accent-500">Admin</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            title={collapsed ? 'توسيع' : 'طي'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {ADMIN_NAV.map((group, gi) => {
            const items = group.items.filter((i) => canSee(i.permission));
            if (items.length === 0) return null;
            return (
              <div key={gi}>
                {group.title && !collapsed && (
                  <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-400">{group.title}</p>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition ' +
                          (active ? 'bg-accent-500 text-white' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900')
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <span>{item.icon}</span>
                        {!collapsed && (
                          <span className="flex-1 truncate">
                            {item.label}
                            {!item.ready && <span className="mr-1 text-[10px] font-normal opacity-70">قريبًا</span>}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute right-0 top-0 h-full w-72 overflow-y-auto bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm font-extrabold text-ink-900">
              ERBOTLI <span className="text-accent-500">Admin</span>
            </p>
            <nav className="space-y-5">
              {ADMIN_NAV.map((group, gi) => {
                const items = group.items.filter((i) => canSee(i.permission));
                if (items.length === 0) return null;
                return (
                  <div key={gi}>
                    {group.title && <p className="mb-1.5 px-1 text-[11px] font-bold uppercase text-ink-400">{group.title}</p>}
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold ' +
                            (pathname === item.href ? 'bg-accent-500 text-white' : 'text-ink-600')
                          }
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-ink-600 md:hidden">
              ☰
            </button>
            <button
              onClick={() => setPaletteOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-xs text-ink-400 hover:border-ink-200"
            >
              🔍 بحث سريع
              <kbd className="rounded border border-ink-100 px-1 text-[10px]">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />

            <div className="relative">
              <button
                onClick={() => setQuickOpen((v) => !v)}
                className="rounded-full bg-accent-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-accent-600"
                title="إجراء سريع"
              >
                + جديد
              </button>
              {quickOpen && (
                <div className="absolute left-0 z-20 mt-2 w-56 rounded-xl2 border border-ink-100 bg-surface p-2 shadow-card">
                  <QuickAction href="/admin/team/employees" label="🧑‍💼 إضافة موظف" ready />
                  <QuickAction href="/admin/customers/crm" label="🎯 إضافة عميل محتمل" ready />
                  <QuickAction label="👤 إضافة مستخدم" />
                  <QuickAction label="🏷️ إنشاء كود خصم" />
                  <QuickAction label="📢 نشر إعلان" />
                  <QuickAction label="🎫 فتح تذكرة" />
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-sm hover:border-ink-200"
                title="الإشعارات"
              >
                🔔
              </button>
              {notifOpen && (
                <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl2 border border-ink-100 bg-surface p-4 shadow-card">
                  <p className="text-sm font-bold text-ink-900">الإشعارات</p>
                  <p className="mt-2 text-xs leading-relaxed text-ink-400">
                    ما فيه نظام إشعارات فعلي بعد — هذا القسم قريبًا، وما راح يعرض بيانات وهمية لين يصير حقيقي.
                  </p>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-ink-100 bg-surface px-3 py-1.5 text-sm"
              >
                <span className="max-w-[120px] truncate font-semibold text-ink-800">{userName}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">
                  {ROLE_LABEL_AR[role] ?? role}
                </span>
              </button>
              {profileOpen && (
                <div className="absolute left-0 z-20 mt-2 w-48 rounded-xl2 border border-ink-100 bg-surface p-2 shadow-card">
                  <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                    ⬅ رجوع للتطبيق
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full rounded-lg px-3 py-2 text-right text-sm text-accent-600 hover:bg-ink-50"
                  >
                    خروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        canSearchUsers={perms.has('users.view')}
        canSearchLeads={perms.has('crm.view')}
      />
    </div>
  );
}

function QuickAction({ href, label, ready }: { href?: string; label: string; ready?: boolean }) {
  if (ready && href) {
    return (
      <Link href={href} className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
        {label}
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-300">
      <span>{label}</span>
      <span className="text-[10px] font-bold">قريبًا</span>
    </div>
  );
}
