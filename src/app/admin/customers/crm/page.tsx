import { PermissionGate } from '@/components/admin/PermissionGate';
import { CrmClient } from './CrmClient';

export default function CrmPage() {
  return (
    <PermissionGate permission="crm.view">
      <CrmClient />
    </PermissionGate>
  );
}
