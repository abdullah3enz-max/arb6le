import { PermissionGate } from '@/components/admin/PermissionGate';
import { LeadsClient } from './LeadsClient';

export default function LeadsPage() {
  return (
    <PermissionGate permission="crm.view">
      <LeadsClient />
    </PermissionGate>
  );
}
