import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { addXp } from '@/lib/gamification';

const schema = z.object({ answers: z.array(z.object({ questionId: z.string(), given: z.string() })) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const quiz = await db.quiz.findUnique({ where: { id }, include: { questions: true } });
    if (!quiz || quiz.userId !== user.id) return NextResponse.json({ error: 'الاختبار غير موجود.' }, { status: 404 });

    const graded = body.answers.map((a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      const correct = question ? normalize(a.given) === normalize(question.correctAnswer) : false;
      return { questionId: a.questionId, given: a.given, correct };
    });

    const scorePct = quiz.questions.length ? (graded.filter((g) => g.correct).length / quiz.questions.length) * 100 : 0;

    const attempt = await db.quizAttempt.create({
      data: { userId: user.id, quizId: id, answersJson: graded, scorePct, finishedAt: new Date() }
    });

    // Item 22 (spaced repetition): wrong answers get queued for review, right ones deferred.
    for (const g of graded) {
      const question = quiz.questions.find((q) => q.id === g.questionId);
      if (!question) continue;
      await db.reviewItem.upsert({
        where: { userId_conceptId: { userId: user.id, conceptId: question.conceptId } },
        create: {
          userId: user.id,
          conceptId: question.conceptId,
          dueAt: g.correct ? addDays(new Date(), 4) : addDays(new Date(), 1),
          lastResult: g.correct ? 'GOOD' : 'AGAIN'
        },
        update: {
          dueAt: g.correct ? addDays(new Date(), 4) : addDays(new Date(), 1),
          lastResult: g.correct ? 'GOOD' : 'AGAIN',
          reviewCount: { increment: 1 }
        }
      });
    }

    await addXp(user.id, Math.round(scorePct / 5) + graded.length, 'quiz_completed');

    return NextResponse.json({ attempt, graded, scorePct });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'يجب تسجيل الدخول.' }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تسجيل الإجابات.' }, { status: 500 });
  }
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
