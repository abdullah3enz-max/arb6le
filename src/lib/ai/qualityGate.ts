import { computeConnectionScore, passesThreshold } from '@/lib/ai/scoring';
import type { ConnectionCandidate, CriticVerdict } from '@/lib/ai/types';

export interface GateResult {
  approved: boolean;
  score: number;
  status: 'APPROVED' | 'REJECTED' | 'BELOW_THRESHOLD';
  rejectionReason?: string;
}

/**
 * Final Quality Gate — the single place that decides whether a bridge is ever shown.
 * Nothing bypasses this: not a high score with a critic rejection, not a critic approval
 * with a low score. Both must pass, and an ungrounded factual claim never passes either way.
 */
export function runQualityGate(candidate: ConnectionCandidate, critic: CriticVerdict): GateResult {
  const score = computeConnectionScore(candidate.scoreBreakdown);

  if (critic.verdict === 'REJECT') {
    return {
      approved: false,
      score,
      status: 'REJECTED',
      rejectionReason: `Critic rejected (${critic.failedCheck ?? 'unspecified'}): ${critic.reason}`
    };
  }

  if (!passesThreshold(score)) {
    return {
      approved: false,
      score,
      status: 'BELOW_THRESHOLD',
      rejectionReason: `Score ${score} below threshold.`
    };
  }

  if (candidate.sources.every((s) => s.sourceType === 'USER_PROVIDED')) {
    return {
      approved: false,
      score,
      status: 'REJECTED',
      rejectionReason: 'No independent source backs the real-world fact this bridge relies on.'
    };
  }

  return { approved: true, score, status: 'APPROVED' };
}
