import { PermissionGate } from '@/components/admin/PermissionGate';
import { EmployeesClient } from './EmployeesClient';

export default function EmployeesPage() {
  return (
    <PermissionGate permission="employees.view">
      <EmployeesClient />
    </PermissionGate>
  );
}
