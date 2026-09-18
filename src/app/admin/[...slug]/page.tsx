import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { findNavItem } from '@/lib/admin/navConfig';

/**
 * Every sidebar item that doesn't have a dedicated page.tsx yet lands here. Renders an honest
 * "قريبًا" placeholder — never fake data — and enforces the exact same server-side permission
 * check the sidebar itself uses to decide whether to show the link, so a direct URL hit is
 * gated identically to a hidden nav item (item 25: never rely on hiding UI alone).
 */
export default async function AdminPlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const pathname = '/admin/' + slug.join('/');
  const item = findNavItem(pathname);

  if (!item) {
    return (
      <div className="rounded-xl2 border border-ink-100 bg-surface p-8 text-center">
        <p className="text-lg font-bold text-ink-900">الصفحة غير موجودة</p>
      </div>
    );
  }

  if (item.permission) {
    const user = await getCurrentUser();
    const allowed = user ? await hasPermission(user, item.permission) : false;
    if (!allowed) {
      return (
        <div className="rounded-xl2 border border-accent-300/30 bg-surface p-8 text-center">
          <p className="text-lg font-bold text-accent-600">🚫 ما عندك صلاحية الوصول لهذا القسم</p>
        </div>
      );
    }
  }

  return (
    <div className="rounded-xl2 border border-ink-100 bg-surface p-10 text-center">
      <div className="mb-3 text-4xl">{item.icon}</div>
      <p className="text-lg font-bold text-ink-900">{item.label}</p>
      <p className="mt-2 text-sm text-ink-500">هذا القسم قريبًا — ما راح نعرض بيانات وهمية لين يصير مبنيًا فعليًا.</p>
    </div>
  );
}
