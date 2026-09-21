import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('tickets.view');
    const { id } = await params;

    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, email: true } } } }
      }
    });
    if (!ticket) return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب التذكرة.' }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.enum(['OPEN', 'AWAITING_USER', 'CLOSED']).optional(),
  assignedToId: z.string().nullable().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('tickets.manage');
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await db.supportTicket.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });

    const ticket = await db.supportTicket.update({
      where: { id },
      data: body,
      include: {
        user: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } }
      }
    });

    if (body.status && body.status !== existing.status) {
      await logAudit({
        userId: actor.id,
        action: 'admin.ticket_status_changed',
        metaJson: { ticketId: id, subject: ticket.subject, from: existing.status, to: body.status, target: ticket.user.id },
        req
      });
    }
    if (body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId) {
      await logAudit({
        userId: actor.id,
        action: 'admin.ticket_assigned',
        metaJson: { ticketId: id, subject: ticket.subject, assignedToId: body.assignedToId, target: ticket.user.id },
        req
      });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث التذكرة.' }, { status: 500 });
  }
}
