import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AuthError } from '@/lib/auth';
import { logAudit, requirePermission } from '@/lib/rbac';
import { describeConfiguredModels } from '@/lib/ai/router';
import { runAssociationBenchmark } from '@/lib/ai/benchmark/runner';
import type { FeedbackReaction } from '@prisma/client';

const ACTIONS = ['association.benchmark.started', 'association.benchmark', 'association.benchmark.failed'];

const schema = z.object({
  limit: z.number().int().min(5).max(100).default(20),
  /** Another model of the configured provider (e.g. an OpenRouter model id); empty = current. */
  model: z.string().trim().max(120).optional()
});

/** Runs the fixed 100-fact benchmark in the background (it spends real model calls). */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('settings.manage');
    const body = schema.parse(await req.json().catch(() => ({})));
    const model = body.model || undefined;
    const runId = `bench_${Date.now()}`;
    const meta = { runId, limit: body.limit, model: model ?? describeConfiguredModels().strong };

    await logAudit({ userId: user.id, action: 'association.benchmark.started', metaJson: meta, req });
    const startedAt = new Date().toISOString();
    runAssociationBenchmark({ userId: user.id, limit: body.limit, model })
      .then((metrics) =>
        logAudit({
          userId: user.id,
          action: 'association.benchmark',
          metaJson: { ...meta, startedAt, finishedAt: new Date().toISOString(), metrics }
        })
      )
      .catch((error) =>
        logAudit({
          userId: user.id,
          action: 'association.benchmark.failed',
          metaJson: { ...meta, error: error instanceof Error ? error.message : String(error) }
        })
      );

    return NextResponse.json({ ok: true, runId });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'بيانات غير صحيحة.' }, { status: 400 });
    return NextResponse.json({ error: 'فشل تشغيل الاختبار.' }, { status: 500 });
  }
}

const POSITIVE: FeedbackReaction[] = ['LOVE', 'LIKE'];
const NEGATIVE: FeedbackReaction[] = ['DISLIKE', 'INCORRECT'];

/** Recent runs, plus the real "Good" rate per association type from students' 👍/👎. */
export async function GET() {
  try {
    await requirePermission('analytics.view');
    const [runs, feedback] = await Promise.all([
      db.auditLog.findMany({ where: { action: { in: ACTIONS } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      db.connectionFeedback.findMany({
        select: { reaction: true, connection: { select: { scoreBreakdown: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5000
      })
    ]);

    const goodRate: Record<string, { good: number; bad: number; rate: number | null }> = {};
    for (const f of feedback) {
      const type = (f.connection.scoreBreakdown as { connectionType?: string } | null)?.connectionType ?? 'UNKNOWN';
      const row = (goodRate[type] ??= { good: 0, bad: 0, rate: null });
      if (POSITIVE.includes(f.reaction)) row.good++;
      if (NEGATIVE.includes(f.reaction)) row.bad++;
    }
    for (const row of Object.values(goodRate)) row.rate = row.good + row.bad ? row.good / (row.good + row.bad) : null;

    return NextResponse.json({
      currentModel: describeConfiguredModels().strong,
      runs: runs.map((r) => ({ id: r.id, action: r.action, createdAt: r.createdAt, meta: r.metaJson })),
      goodRate
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'غير مسموح.' }, { status: 403 });
    return NextResponse.json({ error: 'فشل جلب النتائج.' }, { status: 500 });
  }
}
