import type { AssociationScoreBreakdown } from './types';

/**
 * Connection Scoring System (item 8) — internal only, never shown to the user. Weighted so
 * that a "clever but slow to parse" bridge loses to a "boring but instant" one: directness
 * and simplicity dominate on purpose, and confusionRisk is a straight penalty rather than
 * being averaged in like the others.
 */
const WEIGHTS: Record<Exclude<keyof AssociationScoreBreakdown, 'confusionRisk'>, number> = {
  directness: 0.28,
  simplicity: 0.22,
  familiarity: 0.2,
  memorability: 0.17,
  relevance: 0.13
};

const CONFUSION_PENALTY_WEIGHT = 0.5;

export const CONNECTION_SCORE_THRESHOLD = Number(process.env.CONNECTION_SCORE_THRESHOLD ?? 75);

export function computeConnectionScore(breakdown: AssociationScoreBreakdown): number {
  const positive = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
    (sum, key) => sum + breakdown[key] * WEIGHTS[key],
    0
  );
  const score = positive - breakdown.confusionRisk * CONFUSION_PENALTY_WEIGHT;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function passesThreshold(score: number): boolean {
  return score >= CONNECTION_SCORE_THRESHOLD;
}
