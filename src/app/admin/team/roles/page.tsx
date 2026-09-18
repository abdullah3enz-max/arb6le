import { PermissionGate } from '@/components/admin/PermissionGate';
import { RolesClient } from './RolesClient';

export default function RolesPermissionsPage() {
  return (
    <PermissionGate permission="employees.manage">
      <RolesClient />
    </PermissionGate>
  );
}
