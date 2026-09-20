import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';

/** List every quiz the user has (across all documents) for Study Mode's Quizzes tab, each with
 * its question count and latest attempt score so the tab can show progress at a glance. */
export async function GET() {
  try {
    const user = await requireUser();
    const quizzes = await db.quiz.findMany({
      where: { userId: user.id },
      include: {
        document: { select: { fileName: true } },
        _count: { select: { questions: true } },
        attempts: { orderBy: { startedAt: 'desc' }, take: 1, select: { scorePct: true, startedAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      quizzes: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        documentName: q.document.fileName,
        questionCount: q._count.questions,
        lastAttempt: q.attempts[0] ?? null
      }))
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    return NextResponse.json({ error: 'فشل جلب الاختبارات.' }, { status: 500 });
  }
}
