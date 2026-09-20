import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

/** Item 22/23: due-now items for Study Mode's spaced-repetition queue. `kind` narrows to just
 * flashcard-backed or concept-backed review items — Study Mode's Flashcards tab only ever wants
 * the former, so it never leaks a random concept-only item into the flip-card flow. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const kind = req.nextUrl.searchParams.get('kind');
    const kindFilter =
      kind === 'flashcard' ? { flashcardId: { not: null } } : kind === 'concept' ? { conceptId: { not: null } } : {};

    const items = await db.reviewItem.findMany({
      where: { userId: user.id, dueAt: { lte: new Date() }, ...kindFilter },
      include: {
        concept: { include: { connections: { where: { status: 'APPROVED' }, take: 1 } } },
        flashcard: { include: { concept: { select: { document: { select: { fileName: true } } } } } }
      },
      orderBy: { dueAt: 'asc' },
      take: 30
    });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب قائمة المراجعة.' }, { status: 500 });
  }
}

const schema = z.object({ reviewItemId: z.string(), result: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']) });

// SM-2-inspired interval growth: wrong answers reset to tomorrow, easy answers grow fastest.
const INTERVAL_MULTIPLIER: Record<'AGAIN' | 'HARD' | 'GOOD' | 'EASY', number> = { AGAIN: 0, HARD: 1.2, GOOD: 2, EASY: 3 };

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const item = await db.reviewItem.findUnique({ where: { id: body.reviewItemId } });
    if (!item || item.userId !== user.id) return NextResponse.json({ error: 'العنصر غير موجود.' }, { status: 404 });

    const nextInterval = body.result === 'AGAIN' ? 1 : Math.round(item.intervalDays * INTERVAL_MULTIPLIER[body.result]);
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + Math.max(1, nextInterval));

    const updated = await db.reviewItem.update({
      where: { id: item.id },
      data: { intervalDays: Math.max(1, nextInterval), dueAt, lastResult: body.result, reviewCount: { increment: 1 } }
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تحديث المراجعة.' }, { status: 500 });
  }
}
