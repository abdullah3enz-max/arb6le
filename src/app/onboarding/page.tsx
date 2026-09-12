import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { OnboardingWizard } from '@/components/OnboardingWizard';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <OnboardingWizard />;
}
