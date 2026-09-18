import type { Role } from '@prisma/client';

/**
 * Single source of truth for every permission the admin back-office understands. Also used to
 * seed `Permission`/`RolePermission` (prisma/seed.ts) and to render the Roles & Permissions
 * matrix — add a key here once, it shows up everywhere else automatically.
 *
 * Deliberately dependency-free (no `@/lib/db`, no `@/lib/auth`) — prisma/seed.ts runs as a plain
 * Node script outside any Next.js request, and importing `next/headers` transitively there is
 * fragile. Keep it that way; put anything DB/session-dependent in `../rbac.ts` instead.
 */
export const PERMISSIONS = [
  { key: 'users.view', category: 'users', descriptionAr: 'عرض المستخدمين' },
  { key: 'users.edit', category: 'users', descriptionAr: 'تعديل بيانات/خطة المستخدم' },
  { key: 'users.suspend', category: 'users', descriptionAr: 'تعليق/تفعيل حساب مستخدم' },
  { key: 'crm.view', category: 'crm', descriptionAr: 'عرض العملاء المحتملين (CRM)' },
  { key: 'crm.edit', category: 'crm', descriptionAr: 'تعديل بيانات العملاء المحتملين' },
  { key: 'crm.delete', category: 'crm', descriptionAr: 'حذف عملاء محتملين' },
  { key: 'subscriptions.view', category: 'subscriptions', descriptionAr: 'عرض الاشتراكات' },
  { key: 'subscriptions.edit', category: 'subscriptions', descriptionAr: 'تعديل الاشتراكات والباقات' },
  { key: 'payments.view', category: 'payments', descriptionAr: 'عرض المدفوعات والفواتير' },
  { key: 'payments.refund', category: 'payments', descriptionAr: 'استرجاع مبالغ' },
  { key: 'tickets.view', category: 'support', descriptionAr: 'عرض تذاكر الدعم' },
  { key: 'tickets.manage', category: 'support', descriptionAr: 'إدارة والرد على تذاكر الدعم' },
  { key: 'analytics.view', category: 'analytics', descriptionAr: 'عرض التحليلات وتقارير الاستخدام' },
  { key: 'marketing.manage', category: 'marketing', descriptionAr: 'إدارة الحملات وأكواد الخصم' },
  { key: 'content.manage', category: 'content', descriptionAr: 'إدارة المحتوى (الأسئلة الشائعة/الإعلانات)' },
  { key: 'employees.view', category: 'employees', descriptionAr: 'عرض الموظفين' },
  { key: 'employees.manage', category: 'employees', descriptionAr: 'إضافة/تعديل الموظفين وصلاحياتهم' },
  { key: 'settings.manage', category: 'settings', descriptionAr: 'إدارة إعدادات المنصة' },
  { key: 'audit_logs.view', category: 'security', descriptionAr: 'عرض سجل الأمان (Audit Logs)' },
  {
    key: 'owner_only_actions',
    category: 'security',
    descriptionAr: 'إجراءات حساسة تقتصر على المالك فقط (لا يمكن منحها كاستثناء)'
  }
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

/**
 * Section-14 role definitions, expressed as permission grants. OWNER is deliberately absent —
 * it bypasses this table entirely (see hasPermission in ../rbac.ts) rather than being "granted
 * everything", so `owner_only_actions` can never leak to anyone else through a role-default list.
 */
export const ROLE_DEFAULTS: Partial<Record<Role, PermissionKey[]>> = {
  ADMIN: PERMISSIONS.map((p) => p.key).filter((k) => k !== 'owner_only_actions'),
  SUPPORT: ['users.view', 'tickets.view', 'tickets.manage'],
  SALES: ['crm.view', 'crm.edit', 'crm.delete', 'users.view'],
  FINANCE: ['subscriptions.view', 'subscriptions.edit', 'payments.view', 'payments.refund'],
  ANALYST: ['analytics.view']
};
