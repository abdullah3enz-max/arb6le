import { db } from '@/lib/db';

export interface PlanLimits {
  maxDocuments: number;
  maxPagesPerDoc: number;
  maxConnectionsPerMonth: number;
  maxQuizzesPerMonth: number;
  studyMode: boolean;
  spacedRepetition: boolean;
  prioritySupport: boolean;
}

export class EntitlementError extends Error {}

function currentPeriod() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}

export async function getActivePlan(userId: string) {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });
  if (sub) return sub.plan;

  const freePlan = await db.plan.findUnique({ where: { code: 'FREE' } });
  if (!freePlan) throw new Error('FREE plan missing — run prisma/seed.ts.');
  return freePlan;
}

async function getOrCreateUsage(userId: string) {
  const { periodStart, periodEnd } = currentPeriod();
  return db.usage.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    create: { userId, periodStart, periodEnd },
    update: {}
  });
}

/** Call before any metered action. Throws EntitlementError with a user-facing Arabic message. */
export async function checkAndTrackUsage(
  userId: string,
  metric: 'documents' | 'connections' | 'quizzes',
  planLimitKey: 'maxDocuments' | 'maxConnectionsPerMonth' | 'maxQuizzesPerMonth'
) {
  const plan = await getActivePlan(userId);
  const limits = plan.limitsJson as unknown as PlanLimits;
  const usage = await getOrCreateUsage(userId);
  const current = usage[metric];
  const limit = limits[planLimitKey];

  if (limit >= 0 && current >= limit) {
    throw new EntitlementError(
      `وصلت للحد الأقصى لخطة ${plan.nameAr} (${limit}). ترقّ لخطة أعلى للاستمرار.`
    );
  }

  await db.usage.update({
    where: { userId_periodStart: { userId, periodStart: usage.periodStart } },
    data: { [metric]: { increment: 1 } }
  });
}

export async function hasFeature(userId: string, feature: 'studyMode' | 'spacedRepetition' | 'prioritySupport') {
  const plan = await getActivePlan(userId);
  const limits = plan.limitsJson as unknown as PlanLimits;
  return Boolean(limits[feature]);
}
