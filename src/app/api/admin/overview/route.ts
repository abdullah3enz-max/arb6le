import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requireStaff } from '@/lib/rbac';
import { describeAuditLog, extractTargetUserIds } from '@/lib/admin/auditFormat';

/** Item 28: Admin Dashboard KPIs — Users, Revenue proxy, Usage, AI usage, Errors, Feedback. */
export async function GET() {
  try {
    await requireStaff();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      newUsersThisWeek,
      activeSubs,
      documentsTotal,
      failedDocuments,
      aiGenerations,
      feedbackCounts,
      worldCounts,
      planCounts,
      recentActivity
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.subscription.count({ where: { status: 'ACTIVE' } }),
      db.document.count(),
      db.document.count({ where: { status: 'FAILED' } }),
      db.aiGeneration.aggregate({ _sum: { costCents: true }, _count: true }),
      db.connectionFeedback.groupBy({ by: ['reaction'], _count: true }),
      db.connection.groupBy({ by: ['worldCategory'], _count: true, where: { status: 'APPROVED' } }),
      db.subscription.groupBy({ by: ['planId'], _count: true, where: { status: 'ACTIVE' } }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { email: true, name: true } } }
      })
    ]);

    const targetIds = Array.from(new Set(recentActivity.flatMap((l) => extractTargetUserIds(l.metaJson))));
    const targetUsers = await db.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, email: true, name: true } });
    const targetMap = new Map(targetUsers.map((u) => [u.id, u.name ?? u.email]));

    return NextResponse.json({
      userCount,
      newUsersThisWeek,
      activeSubscriptions: activeSubs,
      documentsTotal,
      failedDocuments,
      aiCostCentsTotal: aiGenerations._sum.costCents ?? 0,
      aiGenerationsTotal: aiGenerations._count,
      feedbackCounts,
      popularWorlds: worldCounts,
      planCounts,
      recentActivity: recentActivity.map((l) => ({ ...l, summary: describeAuditLog(l, (id) => targetMap.get(id)) }))
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب البيانات.' }, { status: 500 });
  }
}
