import { PermissionGate } from '@/components/admin/PermissionGate';
import { UsersClient } from './UsersClient';

export default function AdminUsersPage() {
  return (
    <PermissionGate permission="users.view">
      <UsersClient />
    </PermissionGate>
  );
}
