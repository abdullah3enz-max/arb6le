import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import type { PermissionKey } from '@/lib/rbac/permissions';

/**
 * Server-side gate for a whole page's content, not just its data. The API routes already enforce
 * permissions independently (so no data can leak even without this), but per item 25 — "don't
 * rely on hiding UI alone" — the page chrome itself (titles, "add" buttons, forms) shouldn't
 * render at all for a user who can't act on it. Every real (non-placeholder) admin page wraps
 * its client component in this.
 */
export async function PermissionGate({
  permission,
  children
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const allowed = user ? await hasPermission(user, permission) : false;

  if (!allowed) {
    return (
      <div className="rounded-xl2 border border-accent-300/30 bg-surface p-8 text-center">
        <p className="text-lg font-bold text-accent-600">🚫 ما عندك صلاحية الوصول لهذا القسم</p>
      </div>
    );
  }

  return <>{children}</>;
}
