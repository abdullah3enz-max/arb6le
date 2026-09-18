import { PermissionGate } from '@/components/admin/PermissionGate';
import { AiUsageClient } from './AiUsageClient';

export default function AiUsagePage() {
  return (
    <PermissionGate permission="analytics.view">
      <AiUsageClient />
    </PermissionGate>
  );
}
