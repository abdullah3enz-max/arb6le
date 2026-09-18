import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError, hashPassword } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

const STAFF_ROLES = ['OWNER', 'ADMIN', 'SUPPORT', 'SALES', 'FINANCE', 'ANALYST'] as const;

export async function GET() {
  try {
    await requirePermission('employees.view');
    const employees = await db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ employees });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب الموظفين.' }, { status: 500 });
  }
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(STAFF_ROLES)
});

/**
 * Creates a staff account directly with the given password — there is no outbound-email
 * infrastructure yet to send a real invite link, so this does not pretend to (no fake "invite
 * sent" toast). The admin shares the password with the new employee out of band.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('employees.manage');
    const body = createSchema.parse(await req.json());

    // Only an existing OWNER may mint another OWNER — never something employees.manage alone unlocks.
    if (body.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ error: 'إنشاء حساب مالك يتطلب صلاحية المالك نفسه.' }, { status: 403 });
    }

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: 'هذا البريد مستخدم من قبل.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);
    const employee = await db.user.create({
      data: { email: body.email, name: body.name, passwordHash, role: body.role },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true }
    });

    await logAudit({
      userId: actor.id,
      action: 'admin.employee_created',
      metaJson: { target: employee.id, email: employee.email, role: employee.role },
      req
    });

    return NextResponse.json({ employee });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إنشاء الموظف.' }, { status: 500 });
  }
}

const statusSchema = z.object({ userId: z.string(), status: z.enum(['ACTIVE', 'DISABLED']) });

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requirePermission('employees.manage');
    const body = statusSchema.parse(await req.json());

    const target = await db.user.findUnique({ where: { id: body.userId } });
    if (!target || target.role === 'STUDENT') {
      return NextResponse.json({ error: 'الموظف غير موجود.' }, { status: 404 });
    }
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json({ error: 'تعديل حساب مالك يتطلب صلاحية المالك نفسه.' }, { status: 403 });
    }

    await db.user.update({ where: { id: body.userId }, data: { status: body.status } });
    await logAudit({
      userId: actor.id,
      action: 'admin.employee_status_changed',
      metaJson: { target: body.userId, status: body.status },
      req
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث الموظف.' }, { status: 500 });
  }
}
