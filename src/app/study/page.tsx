import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { StudyFocus } from '@/components/StudyFocus';

export default async function StudyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-10">
      <StudyFocus />
    </main>
  );
}
