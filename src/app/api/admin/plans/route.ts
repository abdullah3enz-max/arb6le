import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

export async function GET() {
  try {
    await requirePermission('subscriptions.view');
    const plans = await db.plan.findMany({ orderBy: { priceMonthlyCents: 'asc' } });
    return NextResponse.json({ plans });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب الخطط.' }, { status: 500 });
  }
}

const schema = z.object({
  code: z.enum(['FREE', 'PLUS', 'PRO']),
  priceMonthlyCents: z.number().int().min(0).optional(),
  limitsJson: z.record(z.union([z.number(), z.boolean()])).optional()
});

/** Item 25: "اجعل الأسعار قابلة للتعديل من Admin Dashboard." */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requirePermission('subscriptions.edit');
    const body = schema.parse(await req.json());

    const plan = await db.plan.update({
      where: { code: body.code },
      data: {
        ...(body.priceMonthlyCents !== undefined ? { priceMonthlyCents: body.priceMonthlyCents } : {}),
        ...(body.limitsJson ? { limitsJson: body.limitsJson } : {})
      }
    });

    await logAudit({ userId: admin.id, action: 'admin.plan_updated', metaJson: { code: body.code }, req });

    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث الخطة.' }, { status: 500 });
  }
}
