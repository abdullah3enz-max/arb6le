import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import type { WorldCategory, FeedbackReaction } from '@prisma/client';

const POSITIVE: FeedbackReaction[] = ['LOVE', 'LIKE'];

/** Item 11 (Interests Analytics): selection popularity (FavoriteWorld) vs. how well each world
 * category's connections actually land with students (same feedback join as linking-analytics,
 * just grouped by category alone here), plus a real engagement signal — do students who picked
 * a given interest actually process more documents / score higher on quizzes than average? This
 * is the honest version of "conversion per interest": no subscription-upgrade data exists yet to
 * tie interests to revenue, but document/quiz activity is real and already in the database. */
export async function GET() {
  try {
    await requirePermission('analytics.view');

    const [selectionRows, feedbackWithConnection, docCounts, quizAvgs] = await Promise.all([
      db.favoriteWorld.findMany({ select: { category: true, userId: true } }),
      db.connectionFeedback.findMany({ select: { reaction: true, connection: { select: { worldCategory: true } } } }),
      db.document.groupBy({ by: ['userId'], _count: true }),
      db.quizAttempt.groupBy({ by: ['userId'], _avg: { scorePct: true } })
    ]);

    const byWorld = new Map<WorldCategory, FeedbackReaction[]>();
    for (const f of feedbackWithConnection) {
      const list = byWorld.get(f.connection.worldCategory) ?? [];
      list.push(f.reaction);
      byWorld.set(f.connection.worldCategory, list);
    }

    const performance = Array.from(byWorld.entries()).map(([category, reactions]) => {
      const total = reactions.length;
      const positive = reactions.filter((r) => POSITIVE.includes(r)).length;
      const negative = reactions.filter((r) => r === 'DISLIKE' || r === 'INCORRECT').length;
      return { category, total, acceptanceRate: total > 0 ? positive / total : null, positive, negative };
    });

    const docCountMap = new Map(docCounts.map((d) => [d.userId, d._count]));
    const quizAvgMap = new Map(quizAvgs.map((q) => [q.userId, q._avg.scorePct]));

    const usersByCategory = new Map<WorldCategory, string[]>();
    for (const row of selectionRows) {
      const list = usersByCategory.get(row.category) ?? [];
      list.push(row.userId);
      usersByCategory.set(row.category, list);
    }

    const selectionCounts = Array.from(usersByCategory.entries()).map(([category, userIds]) => {
      const docValues = userIds.map((id) => docCountMap.get(id) ?? 0);
      const quizValues = userIds.map((id) => quizAvgMap.get(id)).filter((v): v is number => v !== null && v !== undefined);
      return {
        category,
        count: userIds.length,
        avgDocuments: docValues.length > 0 ? docValues.reduce((a, b) => a + b, 0) / docValues.length : 0,
        avgQuizScore: quizValues.length > 0 ? quizValues.reduce((a, b) => a + b, 0) / quizValues.length : null
      };
    });

    return NextResponse.json({ selectionCounts, performance });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب تحليلات الاهتمامات.' }, { status: 500 });
  }
}
