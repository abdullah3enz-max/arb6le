import { describe, expect, it } from 'vitest';
import { mergePermissions, hasPermission } from './rbac';

describe('mergePermissions', () => {
  it('returns the role defaults when there are no overrides', () => {
    const effective = mergePermissions(['users.view', 'users.edit'], []);
    expect(effective.has('users.view')).toBe(true);
    expect(effective.has('users.edit')).toBe(true);
    expect(effective.has('payments.refund')).toBe(false);
  });

  it('an override can grant a permission beyond the role default', () => {
    const effective = mergePermissions(['users.view'], [{ key: 'payments.refund', granted: true }]);
    expect(effective.has('users.view')).toBe(true);
    expect(effective.has('payments.refund')).toBe(true);
  });

  it('an override can revoke a permission the role would normally grant', () => {
    const effective = mergePermissions(['users.view', 'users.edit'], [{ key: 'users.edit', granted: false }]);
    expect(effective.has('users.view')).toBe(true);
    expect(effective.has('users.edit')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('OWNER bypasses the permission table entirely, even for owner_only_actions', async () => {
    const owner = { id: 'u1', role: 'OWNER' as const };
    expect(await hasPermission(owner, 'owner_only_actions')).toBe(true);
    expect(await hasPermission(owner, 'users.view')).toBe(true);
  });
});
