import { PermissionGate } from '@/components/admin/PermissionGate';
import { LinkingAnalyticsClient } from './LinkingAnalyticsClient';

export default function LinkingAnalyticsPage() {
  return (
    <PermissionGate permission="analytics.view">
      <LinkingAnalyticsClient />
    </PermissionGate>
  );
}
