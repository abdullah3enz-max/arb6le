import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Scoped by userId, not just id — a student must never read another student's ticket by
    // guessing/enumerating ids (tenant isolation, same rule as every other user-owned table).
    const ticket = await db.supportTicket.findFirst({
      where: { id, userId: user.id },
      include: {
        assignedTo: { select: { name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, email: true } } } }
      }
    });
    if (!ticket) return NextResponse.json({ error: 'التذكرة غير موجودة.' }, { status: 404 });

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب التذكرة.' }, { status: 500 });
  }
}
