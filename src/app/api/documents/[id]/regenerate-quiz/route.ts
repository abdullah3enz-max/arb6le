import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { regenerateQuiz } from '@/lib/ai/pipeline';

/**
 * Repairs a document whose quiz ended up empty (see regenerateQuiz's doc comment) — a real,
 * observed failure mode where a Quiz row existed with a title but zero questions because every
 * generated question's conceptTitle failed to match a saved concept. Refuses when a real quiz
 * already exists so this never becomes an unbounded "regenerate for fun" button that reruns a
 * paid LLM call on every click.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const document = await db.document.findUnique({ where: { id } });
    if (!document || document.userId !== user.id) {
      return NextResponse.json({ error: 'الملف غير موجود.' }, { status: 404 });
    }

    const existingQuiz = await db.quiz.findFirst({ where: { documentId: id }, include: { _count: { select: { questions: true } } } });
    if (existingQuiz && existingQuiz._count.questions > 0) {
      return NextResponse.json({ error: 'عندك اختبار شغّال لهذا الملف مسبقًا.' }, { status: 409 });
    }

    await regenerateQuiz(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشلت إعادة توليد الاختبار.' }, { status: 500 });
  }
}
