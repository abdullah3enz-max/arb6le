import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, AuthError } from '@/lib/auth';

/** Item 28: Admin Dashboard KPIs — Users, Revenue proxy, Usage, AI usage, Errors, Feedback. */
export async function GET() {
  try {
    await requireAdmin();

    const [userCount, activeSubs, documentsTotal, failedDocuments, aiGenerations, feedbackCounts, worldCounts, planCounts] =
      await Promise.all([
        db.user.count(),
        db.subscription.count({ where: { status: 'ACTIVE' } }),
        db.document.count(),
        db.document.count({ where: { status: 'FAILED' } }),
        db.aiGeneration.aggregate({ _sum: { costCents: true }, _count: true }),
        db.connectionFeedback.groupBy({ by: ['reaction'], _count: true }),
        db.connection.groupBy({ by: ['worldCategory'], _count: true, where: { status: 'APPROVED' } }),
        db.subscription.groupBy({ by: ['planId'], _count: true, where: { status: 'ACTIVE' } })
      ]);

    return NextResponse.json({
      userCount,
      activeSubscriptions: activeSubs,
      documentsTotal,
      failedDocuments,
      aiCostCentsTotal: aiGenerations._sum.costCents ?? 0,
      aiGenerationsTotal: aiGenerations._count,
      feedbackCounts,
      popularWorlds: worldCounts,
      planCounts
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب البيانات.' }, { status: 500 });
  }
}
