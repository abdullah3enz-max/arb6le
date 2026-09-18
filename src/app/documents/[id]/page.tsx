import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { DocumentDetail } from '@/components/DocumentDetail';
import { NavBar } from '@/components/NavBar';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role !== 'STUDENT'} />
      <div className="mt-8">
        <DocumentDetail documentId={id} />
      </div>
    </main>
  );
}
