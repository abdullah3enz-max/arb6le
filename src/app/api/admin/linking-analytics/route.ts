import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import type { AssociationLevel, WorldCategory, FeedbackReaction } from '@prisma/client';

const POSITIVE: FeedbackReaction[] = ['LOVE', 'LIKE'];

function summarizeReactions(reactions: FeedbackReaction[]) {
  const total = reactions.length;
  const positive = reactions.filter((r) => POSITIVE.includes(r)).length;
  const negative = reactions.filter((r) => r === 'DISLIKE' || r === 'INCORRECT').length;
  return { total, acceptanceRate: total > 0 ? positive / total : null, positive, negative };
}

/**
 * Item 10 (Linking Analytics). Breakdown by association level/world category is computed in
 * JS after one feedback fetch (joined to its connection) rather than N grouped queries — the
 * dataset is small at this stage and this stays a single round trip; worth revisiting with raw
 * SQL if feedback volume grows large enough for that to matter.
 */
export async function GET() {
  try {
    await requirePermission('analytics.view');

    const [totalConnections, byStatus, regeneratedCount, feedbackWithConnection] = await Promise.all([
      db.connection.count(),
      db.connection.groupBy({ by: ['status'], _count: true }),
      db.connection.count({ where: { regenerationOf: { not: null } } }),
      db.connectionFeedback.findMany({
        select: {
          userId: true,
          reaction: true,
          connection: { select: { associationLevel: true, worldCategory: true } }
        }
      })
    ]);

    const allReactions = feedbackWithConnection.map((f) => f.reaction);

    const byLevel = new Map<AssociationLevel, FeedbackReaction[]>();
    const byWorld = new Map<WorldCategory, FeedbackReaction[]>();
    const byUser = new Map<string, FeedbackReaction[]>();
    for (const f of feedbackWithConnection) {
      const levelList = byLevel.get(f.connection.associationLevel) ?? [];
      levelList.push(f.reaction);
      byLevel.set(f.connection.associationLevel, levelList);

      const worldList = byWorld.get(f.connection.worldCategory) ?? [];
      worldList.push(f.reaction);
      byWorld.set(f.connection.worldCategory, worldList);

      const userList = byUser.get(f.userId) ?? [];
      userList.push(f.reaction);
      byUser.set(f.userId, userList);
    }

    const topUserEntries = Array.from(byUser.entries())
      .map(([userId, reactions]) => ({ userId, ...summarizeReactions(reactions) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    const feedbackUsers = await db.user.findMany({
      where: { id: { in: topUserEntries.map((u) => u.userId) } },
      select: { id: true, email: true, name: true }
    });
    const feedbackUserMap = new Map(feedbackUsers.map((u) => [u.id, u]));

    const quizPerformanceByLevel = await computeQuizPerformanceByLevel();

    return NextResponse.json({
      totalConnections,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      regeneratedCount,
      regenerationRate: totalConnections > 0 ? regeneratedCount / totalConnections : 0,
      overall: summarizeReactions(allReactions),
      byAssociationLevel: Array.from(byLevel.entries()).map(([level, reactions]) => ({
        level,
        ...summarizeReactions(reactions)
      })),
      byWorldCategory: Array.from(byWorld.entries()).map(([category, reactions]) => ({
        category,
        ...summarizeReactions(reactions)
      })),
      topFeedbackUsers: topUserEntries.map((u) => ({
        userId: u.userId,
        email: feedbackUserMap.get(u.userId)?.email ?? '—',
        name: feedbackUserMap.get(u.userId)?.name ?? null,
        total: u.total,
        acceptanceRate: u.acceptanceRate,
        negative: u.negative
      })),
      quizPerformanceByLevel
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب تحليلات الربط.' }, { status: 500 });
  }
}

interface GradedAnswer {
  questionId: string;
  correct: boolean;
}

/**
 * The one metric the spec explicitly asks for that user feedback alone can't answer: does a
 * stronger association level (DIRECT_MATCH) actually correlate with getting that concept's quiz
 * question RIGHT, not just with the student saying they liked the bridge? Joins
 * Concept -> its approved Connection's level -> its QuizQuestions -> every real QuizAttempt's
 * graded answers for those questions.
 */
async function computeQuizPerformanceByLevel() {
  const [conceptsWithLevel, attempts] = await Promise.all([
    db.concept.findMany({
      where: { connections: { some: { status: 'APPROVED' } } },
      select: {
        connections: { where: { status: 'APPROVED' }, select: { associationLevel: true }, take: 1 },
        quizQuestions: { select: { id: true } }
      }
    }),
    db.quizAttempt.findMany({ select: { answersJson: true } })
  ]);

  const levelByQuestionId = new Map<AssociationLevel, string[]>();
  const questionToLevel = new Map<string, AssociationLevel>();
  for (const concept of conceptsWithLevel) {
    const level = concept.connections[0]?.associationLevel;
    if (!level) continue;
    for (const q of concept.quizQuestions) {
      questionToLevel.set(q.id, level);
      const list = levelByQuestionId.get(level) ?? [];
      list.push(q.id);
      levelByQuestionId.set(level, list);
    }
  }

  const tally = new Map<AssociationLevel, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const answers = (attempt.answersJson as unknown as GradedAnswer[] | null) ?? [];
    for (const a of answers) {
      const level = questionToLevel.get(a.questionId);
      if (!level) continue; // question's concept has no approved connection (or was deleted)
      const entry = tally.get(level) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.correct) entry.correct += 1;
      tally.set(level, entry);
    }
  }

  return Array.from(tally.entries()).map(([level, t]) => ({
    level,
    totalAnswers: t.total,
    correctRate: t.total > 0 ? t.correct / t.total : null
  }));
}
