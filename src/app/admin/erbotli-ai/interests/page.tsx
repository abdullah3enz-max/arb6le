import { PermissionGate } from '@/components/admin/PermissionGate';
import { InterestsClient } from './InterestsClient';

export default function InterestsPage() {
  return (
    <PermissionGate permission="analytics.view">
      <InterestsClient />
    </PermissionGate>
  );
}
