import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { SupportClient } from './SupportClient';

export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  const canManage = user ? await hasPermission(user, 'tickets.manage') : false;

  return (
    <PermissionGate permission="tickets.view">
      <SupportClient canManage={canManage} />
    </PermissionGate>
  );
}
