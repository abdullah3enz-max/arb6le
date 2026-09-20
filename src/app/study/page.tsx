import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { NavBar } from '@/components/NavBar';
import { StudyTabs } from '@/components/StudyTabs';

export default async function StudyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role !== 'STUDENT'} />
      <div className="mt-8">
        <h1 className="text-2xl font-extrabold text-ink-900">Study Mode 🎯</h1>
        <p className="mt-1 text-ink-500">راجع بطاقاتك، اختبر نفسك، أو راجع أهم المعلومات بسرعة.</p>
      </div>
      <div className="mt-6">
        <StudyTabs />
      </div>
    </main>
  );
}
