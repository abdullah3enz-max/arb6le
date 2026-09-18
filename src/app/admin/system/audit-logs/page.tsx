import { PermissionGate } from '@/components/admin/PermissionGate';
import { AuditLogsClient } from './AuditLogsClient';

export default function AuditLogsPage() {
  return (
    <PermissionGate permission="audit_logs.view">
      <AuditLogsClient />
    </PermissionGate>
  );
}
