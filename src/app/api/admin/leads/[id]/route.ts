import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

const LEAD_SOURCES = ['INSTAGRAM', 'TIKTOK', 'X', 'GOOGLE', 'REFERRAL', 'WEBSITE', 'CAMPAIGN', 'OTHER'] as const;
const LEAD_STAGES = ['LEAD', 'CONTACTED', 'TRIAL', 'QUALIFIED', 'PAID', 'RETENTION', 'CHURNED'] as const;

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  potentialPlan: z.enum(['FREE', 'PLUS', 'PRO']).nullable().optional(),
  valueCents: z.number().int().min(0).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  lastContactAt: z.string().datetime().nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('crm.edit');
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'العميل المحتمل غير موجود.' }, { status: 404 });

    const lead = await db.lead.update({
      where: { id },
      data: { ...body, lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : body.lastContactAt },
      include: { assignedTo: { select: { id: true, email: true, name: true } } }
    });

    if (body.stage && body.stage !== existing.stage) {
      await logAudit({
        userId: actor.id,
        action: 'admin.lead_stage_changed',
        metaJson: { leadId: id, name: lead.name, from: existing.stage, to: body.stage },
        req
      });
    } else {
      await logAudit({ userId: actor.id, action: 'admin.lead_updated', metaJson: { leadId: id, name: lead.name }, req });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث العميل المحتمل.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('crm.delete');
    const { id } = await params;

    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'العميل المحتمل غير موجود.' }, { status: 404 });

    await db.lead.delete({ where: { id } }); // cascades notes/tasks
    await logAudit({ userId: actor.id, action: 'admin.lead_deleted', metaJson: { leadId: id, name: existing.name } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل حذف العميل المحتمل.' }, { status: 500 });
  }
}
