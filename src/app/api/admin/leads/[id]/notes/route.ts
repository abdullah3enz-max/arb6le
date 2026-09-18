import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

const schema = z.object({ body: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('crm.edit');
    const { id } = await params;
    const { body } = schema.parse(await req.json());

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: 'العميل المحتمل غير موجود.' }, { status: 404 });

    const note = await db.leadNote.create({
      data: { leadId: id, authorId: actor.id, body },
      include: { author: { select: { name: true, email: true } } }
    });

    await logAudit({ userId: actor.id, action: 'admin.lead_note_added', metaJson: { leadId: id, name: lead.name }, req });

    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إضافة الملاحظة.' }, { status: 500 });
  }
}
