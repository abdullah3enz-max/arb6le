import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit, PERMISSIONS } from '@/lib/rbac';

const EDITABLE_ROLES = ['ADMIN', 'SUPPORT', 'SALES', 'FINANCE', 'ANALYST'] as const;
const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export async function GET() {
  try {
    await requirePermission('employees.manage');

    const [rolePermissions, staffWithOverrides] = await Promise.all([
      db.rolePermission.findMany({ include: { permission: true } }),
      db.user.findMany({
        where: { role: { in: [...EDITABLE_ROLES] } },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          permissionOverrides: { include: { permission: true } }
        },
        orderBy: { email: 'asc' }
      })
    ]);

    return NextResponse.json({
      permissions: PERMISSIONS,
      rolePermissions: rolePermissions.map((rp) => ({ role: rp.role, key: rp.permission.key })),
      staff: staffWithOverrides.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        overrides: u.permissionOverrides.map((o) => ({ key: o.permission.key, granted: o.granted }))
      }))
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب الصلاحيات.' }, { status: 500 });
  }
}

const roleSchema = z.object({
  scope: z.literal('role'),
  role: z.enum(EDITABLE_ROLES),
  key: z.enum(PERMISSION_KEYS as [string, ...string[]]),
  granted: z.boolean()
});

const overrideSchema = z.object({
  scope: z.literal('user'),
  userId: z.string(),
  key: z.enum(PERMISSION_KEYS as [string, ...string[]]),
  granted: z.boolean()
});

const patchSchema = z.union([roleSchema, overrideSchema]);

/**
 * `owner_only_actions` can never be toggled through here for anyone — it is not a grant list
 * entry, it is a standing "must literally be OWNER" check, enforced in code wherever it's used.
 */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('employees.manage');
    const body = patchSchema.parse(await req.json());

    if (body.key === 'owner_only_actions') {
      return NextResponse.json({ error: 'هذه الصلاحية لا يمكن منحها — تقتصر على المالك دائمًا.' }, { status: 400 });
    }

    const permission = await db.permission.findUniqueOrThrow({ where: { key: body.key } });

    if (body.scope === 'role') {
      if (body.granted) {
        await db.rolePermission.upsert({
          where: { role_permissionId: { role: body.role, permissionId: permission.id } },
          create: { role: body.role, permissionId: permission.id },
          update: {}
        });
      } else {
        await db.rolePermission.deleteMany({ where: { role: body.role, permissionId: permission.id } });
      }
      await logAudit({
        userId: actor.id,
        action: 'admin.permission_updated',
        metaJson: { scope: 'role', role: body.role, key: body.key, granted: body.granted },
        req
      });
    } else {
      await db.userPermissionOverride.upsert({
        where: { userId_permissionId: { userId: body.userId, permissionId: permission.id } },
        create: { userId: body.userId, permissionId: permission.id, granted: body.granted },
        update: { granted: body.granted }
      });
      await logAudit({
        userId: actor.id,
        action: 'admin.permission_updated',
        metaJson: { scope: 'user', userId: body.userId, key: body.key, granted: body.granted },
        req
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث الصلاحية.' }, { status: 500 });
  }
}
