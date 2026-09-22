import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { describeConfiguredModels } from '@/lib/ai/router';

/**
 * Item 9 (AI Usage Center). Every number here comes straight from AiGeneration rows written by
 * routedComplete (src/lib/ai/router.ts) — including failures and cache hits, which that function
 * now records explicitly (it used to only record successful, non-cached calls, which would have
 * made failureRate and cacheHitRate silently read as 0% regardless of reality).
 */
export async function GET() {
  try {
    await requirePermission('analytics.view');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // UTC throughout — createdAt is stored as UTC, and bucketing rows into calendar days via
    // toISOString() below only lines up with this loop if both sides agree on the same day
    // boundary. Building trendStart from local Y/M/D and then reading UTC keys off it shifted
    // every bucket by one day whenever the server's local offset put local midnight on the
    // previous UTC day (i.e. most of the time east of UTC) — the chart silently showed no
    // data for "today" even though today's rows existed.
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));

    const [totalAgg, requestsToday, requestsThisMonth, byAgent, byModel, topUsersRaw, failedCount, cacheHitCount, trendRows] =
      await Promise.all([
        db.aiGeneration.aggregate({
          _count: true,
          _sum: { inputTokens: true, outputTokens: true, costCents: true },
          _avg: { latencyMs: true }
        }),
        db.aiGeneration.count({ where: { createdAt: { gte: startOfToday } } }),
        db.aiGeneration.count({ where: { createdAt: { gte: startOfMonth } } }),
        db.aiGeneration.groupBy({ by: ['agent'], _count: true, _sum: { costCents: true }, _avg: { latencyMs: true } }),
        db.aiGeneration.groupBy({
          by: ['model'],
          _count: true,
          _sum: { costCents: true, inputTokens: true, outputTokens: true },
          _avg: { latencyMs: true, inputTokens: true, outputTokens: true },
          _min: { createdAt: true },
          _max: { createdAt: true }
        }),
        db.aiGeneration.groupBy({
          by: ['userId'],
          _count: true,
          _sum: { costCents: true },
          orderBy: { _sum: { costCents: 'desc' } },
          take: 10
        }),
        db.aiGeneration.count({ where: { success: false } }),
        db.aiGeneration.count({ where: { cacheHit: true } }),
        db.aiGeneration.findMany({
          where: { createdAt: { gte: trendStart } },
          select: { createdAt: true, costCents: true, success: true }
        })
      ]);

    // Bucketed in JS rather than a DB date_trunc groupBy — 14 days of rows is small, and this
    // keeps the query portable instead of relying on Postgres-specific raw SQL for one chart.
    // Pure UTC-millisecond arithmetic here (not .setDate(), which mutates by LOCAL time even on
    // a UTC-constructed Date) — the only way both this loop and the toISOString() row-bucketing
    // below agree on the same calendar-day boundaries regardless of server timezone.
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const dailyBuckets = new Map<string, { count: number; costCents: number; failed: number }>();
    for (let i = 0; i < 14; i++) {
      const day = new Date(trendStart.getTime() + i * ONE_DAY_MS);
      dailyBuckets.set(day.toISOString().slice(0, 10), { count: 0, costCents: 0, failed: 0 });
    }
    for (const row of trendRows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = dailyBuckets.get(key);
      if (!bucket) continue;
      bucket.count += 1;
      bucket.costCents += row.costCents;
      if (!row.success) bucket.failed += 1;
    }
    const dailyTrend = Array.from(dailyBuckets.entries()).map(([date, b]) => ({ date, ...b }));

    const currentModels = describeConfiguredModels();

    const byModelWithFailures = await Promise.all(
      byModel.map(async (m) => ({
        model: m.model,
        count: m._count,
        costCents: m._sum.costCents ?? 0,
        totalInputTokens: m._sum.inputTokens ?? 0,
        totalOutputTokens: m._sum.outputTokens ?? 0,
        avgInputTokens: Math.round(m._avg.inputTokens ?? 0),
        avgOutputTokens: Math.round(m._avg.outputTokens ?? 0),
        avgLatencyMs: Math.round(m._avg.latencyMs ?? 0),
        failedCount: await db.aiGeneration.count({ where: { model: m.model, success: false } }),
        firstUsedAt: m._min.createdAt,
        lastUsedAt: m._max.createdAt,
        // Flags this row as whichever tier(s) the current env config would route to right now —
        // the same live-resolved value the "current model" card above the table shows, so the
        // two can never say something different about what's actually active.
        isCurrentFast: m.model === currentModels.fast,
        isCurrentStrong: m.model === currentModels.strong
      }))
    );

    const users = await db.user.findMany({
      where: { id: { in: topUsersRaw.map((u) => u.userId) } },
      select: { id: true, email: true, name: true }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const total = totalAgg._count;

    // Same rows the table below shows, just picked out for the "current model" summary card —
    // null when that tier's configured model has never actually been called yet (e.g. just
    // switched in CranL and no document has been processed since).
    const currentFastStats = byModelWithFailures.find((m) => m.model === currentModels.fast) ?? null;
    const currentStrongStats = byModelWithFailures.find((m) => m.model === currentModels.strong) ?? null;

    return NextResponse.json({
      currentModels: {
        provider: currentModels.provider,
        fast: { model: currentModels.fast, stats: currentFastStats },
        strong: { model: currentModels.strong, stats: currentStrongStats }
      },
      totalRequests: total,
      requestsToday,
      requestsThisMonth,
      totalInputTokens: totalAgg._sum.inputTokens ?? 0,
      totalOutputTokens: totalAgg._sum.outputTokens ?? 0,
      totalCostCents: totalAgg._sum.costCents ?? 0,
      avgLatencyMs: Math.round(totalAgg._avg.latencyMs ?? 0),
      failedGenerations: failedCount,
      failureRate: total > 0 ? failedCount / total : 0,
      cacheHitRate: total > 0 ? cacheHitCount / total : 0,
      byAgent: byAgent
        .map((a) => ({
          agent: a.agent,
          count: a._count,
          costCents: a._sum.costCents ?? 0,
          avgLatencyMs: Math.round(a._avg.latencyMs ?? 0)
        }))
        .sort((a, b) => b.count - a.count),
      topUsers: topUsersRaw.map((u) => ({
        userId: u.userId,
        email: userMap.get(u.userId)?.email ?? '—',
        name: userMap.get(u.userId)?.name ?? null,
        count: u._count,
        costCents: u._sum.costCents ?? 0
      })),
      byModel: byModelWithFailures.sort((a, b) => b.count - a.count),
      dailyTrend
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب بيانات استخدام الذكاء الاصطناعي.' }, { status: 500 });
  }
}
