import { PermissionGate } from '@/components/admin/PermissionGate';
import { BenchmarkClient } from './BenchmarkClient';

export default function AssociationBenchmarkPage() {
  return (
    <PermissionGate permission="analytics.view">
      <BenchmarkClient />
    </PermissionGate>
  );
}
