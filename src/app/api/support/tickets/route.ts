import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

export async function GET() {
  try {
    const user = await requireUser();

    const tickets = await db.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        assignedTo: { select: { name: true, email: true } },
        _count: { select: { messages: true } }
      }
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب التذاكر.' }, { status: 500 });
  }
}

const createSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(5000)
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { subject, body } = createSchema.parse(await req.json());

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject,
        messages: { create: { authorId: user.id, isStaff: false, body } }
      },
      include: { messages: true }
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل إنشاء التذكرة.' }, { status: 500 });
  }
}
