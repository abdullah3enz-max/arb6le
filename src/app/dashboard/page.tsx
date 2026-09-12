import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { UploadArea } from '@/components/UploadArea';
import { DocumentList } from '@/components/DocumentList';
import { GamificationBar } from '@/components/GamificationBar';
import { NavBar } from '@/components/NavBar';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <NavBar userName={user.name ?? user.email} isAdmin={user.role === 'ADMIN'} />

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">هلا {user.name ?? ''} 👋</h1>
          <p className="mt-1 text-ink-500">وش بنربط لك اليوم؟</p>
        </div>
        <GamificationBar />
      </div>

      <div className="mt-6">
        <UploadArea />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-ink-900">ملفاتك</h2>
        <DocumentList />
      </div>
    </main>
  );
}
