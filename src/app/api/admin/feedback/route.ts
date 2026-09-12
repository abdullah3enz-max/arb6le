import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, AuthError } from '@/lib/auth';

/** Item 28/29: review connections flagged DISLIKE/INCORRECT — quality-control queue. */
export async function GET() {
  try {
    await requireAdmin();
    const feedback = await db.connectionFeedback.findMany({
      where: { reaction: { in: ['DISLIKE', 'INCORRECT'] } },
      include: {
        connection: { include: { sources: true, concept: { include: { document: true } } } },
        user: { select: { email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب الملاحظات.' }, { status: 500 });
  }
}
