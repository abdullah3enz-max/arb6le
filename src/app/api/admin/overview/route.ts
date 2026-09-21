import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requireStaff, hasPermission } from '@/lib/rbac';
import { describeAuditLog, extractTargetUserIds } from '@/lib/admin/auditFormat';

/** Item 28: Admin Dashboard KPIs — Users, Revenue proxy, Usage, AI usage, Errors, Feedback. */
export async function GET() {
  try {
    const actor = await requireStaff();
    // Every other widget here is aggregate/non-sensitive, shown to any staff role. Ticket counts
    // are the one exception — support content is gated by tickets.view, so a role without it
    // (SALES, FINANCE, ANALYST) gets this omitted rather than leaking "N open tickets" to a
    // dashboard they're allowed to see for unrelated reasons.
    const canSeeTickets = await hasPermission(actor, 'tickets.view');

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Same UTC-bucketing approach as /api/admin/ai-usage's dailyTrend: 14 rows of raw createdAt
    // timestamps, bucketed in JS by UTC calendar day, so this stays a portable query and agrees
    // with that chart's day boundaries regardless of the server's local timezone.
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));

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
      plans,
      signupRows,
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
      db.plan.findMany({ select: { id: true, code: true, nameAr: true, priceMonthlyCents: true, currency: true } }),
      db.user.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { email: true, name: true } } }
      })
    ]);

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const signupBuckets = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      signupBuckets.set(new Date(trendStart.getTime() + i * ONE_DAY_MS).toISOString().slice(0, 10), 0);
    }
    for (const row of signupRows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      signupBuckets.set(key, (signupBuckets.get(key) ?? 0) + 1);
    }
    const signupTrend = Array.from(signupBuckets.entries()).map(([date, count]) => ({ date, count }));

    const planMap = new Map(plans.map((p) => [p.id, p]));
    const planBreakdown = planCounts.map((p) => {
      const plan = planMap.get(p.planId);
      return {
        planId: p.planId,
        code: plan?.code ?? '—',
        nameAr: plan?.nameAr ?? '—',
        count: p._count,
        mrrCents: (plan?.priceMonthlyCents ?? 0) * p._count
      };
    });
    // Revenue proxy: sum of each active subscription's own plan price, not (active count × one
    // price) — plans can change price over time, so this only assumes today's ACTIVE subscriptions
    // pay today's plan price, never that all active subs share a single plan.
    const mrrCents = planBreakdown.reduce((sum, p) => sum + p.mrrCents, 0);

    const targetIds = Array.from(new Set(recentActivity.flatMap((l) => extractTargetUserIds(l.metaJson))));
    const targetUsers = await db.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, email: true, name: true } });
    const targetMap = new Map(targetUsers.map((u) => [u.id, u.name ?? u.email]));

    const openTicketsCount = canSeeTickets ? await db.supportTicket.count({ where: { status: 'OPEN' } }) : undefined;

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
      planBreakdown,
      mrrCents,
      signupTrend,
      openTicketsCount,
      recentActivity: recentActivity.map((l) => ({ ...l, summary: describeAuditLog(l, (id) => targetMap.get(id)) }))
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب البيانات.' }, { status: 500 });
  }
}
