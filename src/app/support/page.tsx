import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { SupportClient } from '@/components/SupportClient';

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role !== 'STUDENT'} />
      <div className="mt-8">
        <SupportClient />
      </div>
    </main>
  );
}
