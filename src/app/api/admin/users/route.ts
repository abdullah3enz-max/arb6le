import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

export async function GET() {
  try {
    await requirePermission('users.view');
    const users = await db.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        subscriptions: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1 }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب المستخدمين.' }, { status: 500 });
  }
}

const patchSchema = z.object({
  userId: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  planCode: z.enum(['FREE', 'PLUS', 'PRO']).optional()
});

/** Item 28: تعطيل مستخدم / تغيير الخطة, from the Admin Dashboard. */
export async function PATCH(req: NextRequest) {
  try {
    const body = patchSchema.parse(await req.json());

    if (body.status) {
      const admin = await requirePermission('users.suspend');
      await db.user.update({ where: { id: body.userId }, data: { status: body.status } });
      await logAudit({
        userId: admin.id,
        action: 'admin.user_status_changed',
        metaJson: { target: body.userId, status: body.status },
        req
      });
    }

    if (body.planCode) {
      const admin = await requirePermission('users.edit');
      const plan = await db.plan.findUniqueOrThrow({ where: { code: body.planCode } });
      await db.subscription.updateMany({ where: { userId: body.userId, status: 'ACTIVE' }, data: { status: 'CANCELED' } });
      await db.subscription.create({ data: { userId: body.userId, planId: plan.id, status: 'ACTIVE', provider: null } });
      await logAudit({
        userId: admin.id,
        action: 'admin.plan_changed',
        metaJson: { target: body.userId, planCode: body.planCode },
        req
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث المستخدم.' }, { status: 500 });
  }
}
