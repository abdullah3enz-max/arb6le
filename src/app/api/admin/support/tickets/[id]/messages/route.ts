import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission, logAudit } from '@/lib/rbac';

const schema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('tickets.manage');
    const { id } = await params;
    const { body } = schema.parse(await req.json());

    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });

    const message = await db.ticketMessage.create({
      data: { ticketId: id, authorId: actor.id, isStaff: true, body },
      include: { author: { select: { name: true, email: true } } }
    });

    // A staff reply always puts the ball back in the student's court — closing (or staying
    // open, e.g. an internal handoff) is a separate, explicit PATCH, never inferred from a reply.
    await db.supportTicket.update({
      where: { id },
      data: { status: 'AWAITING_USER', lastMessageAt: message.createdAt }
    });

    await logAudit({
      userId: actor.id,
      action: 'admin.ticket_replied',
      metaJson: { ticketId: id, subject: ticket.subject, target: ticket.userId },
      req
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إرسال الرد.' }, { status: 500 });
  }
}
