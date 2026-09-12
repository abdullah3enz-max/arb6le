import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { AdminDashboard } from '@/components/AdminDashboard';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin />
      <div className="mt-8">
        <AdminDashboard />
      </div>
    </main>
  );
}
