import type { NextRequest } from 'next/server';
import type { User } from '@prisma/client';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { PERMISSIONS, ROLE_DEFAULTS, type PermissionKey } from '@/lib/rbac/permissions';

export { PERMISSIONS, ROLE_DEFAULTS, type PermissionKey };

type PermissionUser = Pick<User, 'id' | 'role'>;

/**
 * Pure merge: role grants + this user's overrides -> the effective permission set. Overrides
 * always win, in either direction (grant beyond the role, or revoke something the role would
 * normally allow). Split out from getEffectivePermissions so it's testable without a database.
 */
export function mergePermissions(
  roleGrantKeys: PermissionKey[],
  overrides: { key: PermissionKey; granted: boolean }[]
): Set<PermissionKey> {
  const effective = new Set(roleGrantKeys);
  for (const o of overrides) {
    if (o.granted) effective.add(o.key);
    else effective.delete(o.key);
  }
  return effective;
}

/**
 * All permission keys this user effectively has: the role's *current* grants from the
 * `RolePermission` table (not the static `ROLE_DEFAULTS` map — that map is only ever used to
 * seed the table; once an Owner edits the Roles & Permissions matrix, the DB row is the truth),
 * with this specific user's overrides applied on top.
 */
export async function getEffectivePermissions(user: PermissionUser): Promise<Set<PermissionKey>> {
  if (user.role === 'OWNER') return new Set(PERMISSIONS.map((p) => p.key));

  const [roleGrants, overrides] = await Promise.all([
    db.rolePermission.findMany({ where: { role: user.role }, include: { permission: true } }),
    db.userPermissionOverride.findMany({ where: { userId: user.id }, include: { permission: true } })
  ]);

  return mergePermissions(
    roleGrants.map((rp) => rp.permission.key as PermissionKey),
    overrides.map((o) => ({ key: o.permission.key as PermissionKey, granted: o.granted }))
  );
}

export async function hasPermission(user: PermissionUser, key: PermissionKey): Promise<boolean> {
  if (user.role === 'OWNER') return true;
  const effective = await getEffectivePermissions(user);
  return effective.has(key);
}

/** Mirrors requireUser() in src/lib/auth.ts — same AuthError, same call shape. */
export async function requirePermission(key: PermissionKey) {
  const user = await requireUser();
  if (!(await hasPermission(user, key))) {
    throw new AuthError('FORBIDDEN');
  }
  return user;
}

/**
 * Any staff account (every role except STUDENT) — used for the /admin shell gate and for
 * aggregate, non-sensitive views (like Overview KPIs) that don't warrant a dedicated permission
 * key. Specific actions inside the shell still go through requirePermission.
 */
export async function requireStaff() {
  const user = await requireUser();
  if (user.role === 'STUDENT') {
    throw new AuthError('FORBIDDEN');
  }
  return user;
}

/**
 * Every sensitive admin action should log through here instead of calling db.auditLog.create
 * directly — keeps IP capture and the metaJson shape consistent across all admin routes.
 */
export async function logAudit(params: {
  userId: string;
  action: string;
  metaJson?: Record<string, unknown>;
  req?: NextRequest | Request;
}) {
  const ipAddress = params.req?.headers.get('x-forwarded-for') ?? null;
  await db.auditLog.create({
    data: { userId: params.userId, action: params.action, metaJson: params.metaJson as object | undefined, ipAddress }
  });
}
