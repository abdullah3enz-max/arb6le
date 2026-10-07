import { db } from '@/lib/db';
import type { FeedbackReaction } from '@prisma/client';

/**
 * Item 17: Personalization Loop. Pure bookkeeping, no LLM call — every user interaction
 * nudges Preference.weight, which bridgeScoring.preference() reads back (20% of the ranking).
 */
const REACTION_DELTA: Record<FeedbackReaction, number> = {
  LOVE: 20,
  LIKE: 10,
  NEUTRAL: 0,
  DISLIKE: -15,
  INCORRECT: -30 // heavier penalty — an incorrect claim is worse than "didn't like it"
};

export async function applyFeedbackToPreferences(params: {
  userId: string;
  reaction: FeedbackReaction;
  worldCategory: string;
  associationLevel: string;
  /** A-H association type and the fact type it was used for — read back by preference(). */
  associationType?: string;
  factType?: string;
}) {
  const delta = REACTION_DELTA[params.reaction];
  const keys = [`world:${params.worldCategory.toLowerCase()}`, `association_level:${params.associationLevel.toLowerCase()}`];
  if (params.associationType) {
    const type = params.associationType.toLowerCase();
    keys.push(`association_type:${type}`);
    if (params.factType) keys.push(`fact_assoc:${params.factType.toLowerCase()}:${type}`);
  }

  await Promise.all(
    keys.map((key) =>
      db.preference.upsert({
        where: { userId_key: { userId: params.userId, key } },
        create: { userId: params.userId, key, weight: delta },
        update: { weight: { increment: delta } }
      })
    )
  );
}

export async function recordRegeneration(userId: string, worldCategory: string) {
  // Regenerating (🔄) is a soft negative signal on that specific world, distinct from an
  // explicit 👎, so it gets a smaller penalty.
  await db.preference.upsert({
    where: { userId_key: { userId, key: `world:${worldCategory.toLowerCase()}` } },
    create: { userId, key: `world:${worldCategory.toLowerCase()}`, weight: -5 },
    update: { weight: { increment: -5 } }
  });
}
