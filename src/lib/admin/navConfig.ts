import type { PermissionKey } from '@/lib/rbac/permissions';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  /** null = visible to any staff role (no dedicated permission exists for it yet/at all). */
  permission: PermissionKey | null;
  /** Set once the page has real, working content — everything else renders a "قريبًا" placeholder. */
  ready?: boolean;
}

export interface AdminNavGroup {
  title: string | null; // null for the ungrouped top-level "Overview" entry
  items: AdminNavItem[];
}

/**
 * Single source of truth for the admin sidebar — also used by the catch-all placeholder route
 * (src/app/admin/[...slug]/page.tsx) to resolve a friendly title and to enforce the same
 * permission check server-side, so a direct URL hit is gated identically to the hidden nav item.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  { title: null, items: [{ href: '/admin', label: 'نظرة عامة', icon: '📊', permission: null, ready: true }] },
  {
    title: 'العملاء',
    items: [
      { href: '/admin/customers/users', label: 'المستخدمون', icon: '👥', permission: 'users.view', ready: true },
      { href: '/admin/customers/crm', label: 'CRM', icon: '🧭', permission: 'crm.view', ready: true },
      { href: '/admin/customers/leads', label: 'العملاء المحتملون', icon: '🎯', permission: 'crm.view', ready: true },
      { href: '/admin/customers/support', label: 'الدعم', icon: '🎫', permission: 'tickets.view', ready: true }
    ]
  },
  {
    title: 'الاشتراكات',
    items: [
      { href: '/admin/subscriptions/plans', label: 'الباقات', icon: '📦', permission: 'subscriptions.view' },
      { href: '/admin/subscriptions/active', label: 'الاشتراكات الفعّالة', icon: '🔄', permission: 'subscriptions.view' },
      { href: '/admin/subscriptions/billing', label: 'الفوترة', icon: '🧾', permission: 'payments.view' },
      { href: '/admin/subscriptions/payments', label: 'المدفوعات', icon: '💳', permission: 'payments.view' }
    ]
  },
  {
    title: 'ذكاء ERBOTLI',
    items: [
      {
        href: '/admin/erbotli-ai/usage',
        label: 'استخدام الذكاء الاصطناعي',
        icon: '🤖',
        permission: 'analytics.view',
        ready: true
      },
      {
        href: '/admin/erbotli-ai/linking-analytics',
        label: 'تحليلات الربط',
        icon: '🔗',
        permission: 'analytics.view',
        ready: true
      },
      { href: '/admin/erbotli-ai/interests', label: 'الاهتمامات', icon: '❤️', permission: 'analytics.view', ready: true },
      { href: '/admin/erbotli-ai/processing', label: 'الملفات والمعالجة', icon: '📄', permission: 'analytics.view' }
    ]
  },
  {
    title: 'التحليلات',
    items: [
      { href: '/admin/analytics/growth', label: 'النمو', icon: '📈', permission: 'analytics.view' },
      { href: '/admin/analytics/revenue', label: 'الإيرادات', icon: '💰', permission: 'analytics.view' },
      { href: '/admin/analytics/engagement', label: 'التفاعل', icon: '⚡', permission: 'analytics.view' },
      { href: '/admin/analytics/retention', label: 'الاحتفاظ بالمستخدمين', icon: '🔁', permission: 'analytics.view' }
    ]
  },
  {
    title: 'التسويق',
    items: [
      { href: '/admin/marketing/campaigns', label: 'الحملات', icon: '📣', permission: 'marketing.manage' },
      { href: '/admin/marketing/promo-codes', label: 'أكواد الخصم', icon: '🏷️', permission: 'marketing.manage' },
      { href: '/admin/marketing/referrals', label: 'الإحالات', icon: '🔗', permission: 'marketing.manage' }
    ]
  },
  {
    title: 'المحتوى',
    items: [
      { href: '/admin/content/faqs', label: 'الأسئلة الشائعة', icon: '❓', permission: 'content.manage' },
      { href: '/admin/content/announcements', label: 'الإعلانات', icon: '📢', permission: 'content.manage' },
      { href: '/admin/content/help-center', label: 'مركز المساعدة', icon: '🆘', permission: 'content.manage' }
    ]
  },
  {
    title: 'الفريق',
    items: [
      { href: '/admin/team/employees', label: 'الموظفون', icon: '🧑‍💼', permission: 'employees.view', ready: true },
      { href: '/admin/team/roles', label: 'الأدوار والصلاحيات', icon: '🔐', permission: 'employees.manage', ready: true }
    ]
  },
  {
    title: 'النظام',
    items: [
      { href: '/admin/system/notifications', label: 'الإشعارات', icon: '🔔', permission: null },
      { href: '/admin/system/audit-logs', label: 'سجل الأمان', icon: '🛡️', permission: 'audit_logs.view', ready: true },
      { href: '/admin/system/integrations', label: 'التكاملات', icon: '🧩', permission: 'settings.manage' },
      { href: '/admin/system/settings', label: 'الإعدادات', icon: '⚙️', permission: 'settings.manage' }
    ]
  }
];

export function findNavItem(pathname: string): AdminNavItem | undefined {
  for (const group of ADMIN_NAV) {
    const found = group.items.find((i) => i.href === pathname);
    if (found) return found;
  }
  return undefined;
}
