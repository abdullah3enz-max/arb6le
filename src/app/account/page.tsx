import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { AccountClient } from '@/components/AccountClient';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role !== 'STUDENT'} />
      <AccountClient
        initialName={user.name ?? ''}
        email={user.email}
        createdAt={user.createdAt.toISOString()}
        role={user.role}
      />
    </main>
  );
}
