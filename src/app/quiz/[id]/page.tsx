import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { QuizRunner } from '@/components/QuizRunner';

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const { id } = await params;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role === 'ADMIN'} />
      <div className="mt-8">
        <QuizRunner quizId={id} />
      </div>
    </main>
  );
}
