import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getEffectivePermissions } from '@/lib/rbac';
import { AdminShell } from '@/components/admin/AdminShell';

// Every page under /admin is permission-sensitive and depends on the current session's role —
// never let Next.js serve a cached render (server-side or the client router cache) across users
// or across a role/permission change. A role change must be reflected on the very next request.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role === 'STUDENT') redirect('/dashboard');

  const permissions = Array.from(await getEffectivePermissions(user));

  return (
    <AdminShell userName={user.name ?? user.email} role={user.role} permissions={permissions}>
      {children}
    </AdminShell>
  );
}
