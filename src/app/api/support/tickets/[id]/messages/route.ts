import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

const schema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { body } = schema.parse(await req.json());

    const ticket = await db.supportTicket.findFirst({ where: { id, userId: user.id } });
    if (!ticket) return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });

    const message = await db.ticketMessage.create({
      data: { ticketId: id, authorId: user.id, isStaff: false, body },
      include: { author: { select: { name: true, email: true } } }
    });

    // Always back to OPEN, even from CLOSED — a student reply reopens the ticket rather than
    // landing silently in a thread staff have stopped watching (see TicketStatus in schema.prisma).
    await db.supportTicket.update({
      where: { id },
      data: { status: 'OPEN', lastMessageAt: message.createdAt }
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إرسال الرد.' }, { status: 500 });
  }
}
