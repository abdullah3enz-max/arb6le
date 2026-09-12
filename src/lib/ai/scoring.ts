/**
 * Connection Scoring System — item 10 of the spec.
 * A connection is only shown to the user when its total score clears CONNECTION_SCORE_THRESHOLD.
 * Weighted, not averaged: factual accuracy and relationship strength dominate on purpose —
 * a highly "memorable" but factually shaky connection must not slip through.
 */

export interface ScoreBreakdown {
  semanticRelevance: number; // 0-100: does the connection actually relate to the concept's meaning?
  factualAccuracy: number; // 0-100: is the external-world fact itself correct?
  relationshipStrength: number; // 0-100: same mechanism/sequence/cause-effect, not surface similarity
  memorability: number; // 0-100: does this plausibly help recall?
  preferenceMatch: number; // 0-100: how well this world matches the user's stated preferences
  contextMatch: number; // 0-100: fits the academic domain/register
  specificity: number; // 0-100: concrete and specific vs generic/vague
}

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  factualAccuracy: 0.25,
  relationshipStrength: 0.25,
  semanticRelevance: 0.15,
  specificity: 0.15,
  memorability: 0.1,
  preferenceMatch: 0.06,
  contextMatch: 0.04
};

export const CONNECTION_SCORE_THRESHOLD = Number(process.env.CONNECTION_SCORE_THRESHOLD ?? 80);

export function computeConnectionScore(breakdown: ScoreBreakdown): number {
  const total = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    const value = breakdown[key as keyof ScoreBreakdown];
    return sum + value * weight;
  }, 0);
  return Math.round(total);
}

export function passesThreshold(score: number): boolean {
  return score >= CONNECTION_SCORE_THRESHOLD;
}
