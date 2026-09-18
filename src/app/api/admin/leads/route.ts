import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

const LEAD_SOURCES = ['INSTAGRAM', 'TIKTOK', 'X', 'GOOGLE', 'REFERRAL', 'WEBSITE', 'CAMPAIGN', 'OTHER'] as const;
const LEAD_STAGES = ['LEAD', 'CONTACTED', 'TRIAL', 'QUALIFIED', 'PAID', 'RETENTION', 'CHURNED'] as const;

export async function GET() {
  try {
    await requirePermission('crm.view');

    const leads = await db.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, email: true, name: true } },
        notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true, email: true } } } },
        _count: { select: { notes: true, tasks: true } }
      }
    });

    // Conversion per source (item 5): what share of each source's leads ever reached PAID.
    const bySource = await db.lead.groupBy({ by: ['source'], _count: true });
    const paidBySource = await db.lead.groupBy({ by: ['source'], _count: true, where: { stage: 'PAID' } });
    const paidMap = new Map(paidBySource.map((p) => [p.source, p._count]));
    const sourceConversion = bySource.map((s) => ({
      source: s.source,
      total: s._count,
      converted: paidMap.get(s.source) ?? 0,
      conversionRate: s._count > 0 ? (paidMap.get(s.source) ?? 0) / s._count : 0
    }));

    return NextResponse.json({ leads, sourceConversion });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب العملاء المحتملين.' }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.enum(LEAD_SOURCES).default('OTHER'),
  stage: z.enum(LEAD_STAGES).default('LEAD'),
  potentialPlan: z.enum(['FREE', 'PLUS', 'PRO']).optional(),
  valueCents: z.number().int().min(0).optional(),
  assignedToId: z.string().optional()
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requirePermission('crm.edit');
    const body = createSchema.parse(await req.json());

    const lead = await db.lead.create({
      data: { ...body, email: body.email || null },
      include: { assignedTo: { select: { id: true, email: true, name: true } } }
    });

    await logAudit({ userId: actor.id, action: 'admin.lead_created', metaJson: { leadId: lead.id, name: lead.name }, req });

    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إنشاء العميل المحتمل.' }, { status: 500 });
  }
}
