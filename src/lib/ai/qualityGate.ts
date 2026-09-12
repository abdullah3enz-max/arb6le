import { computeConnectionScore, passesThreshold, type ScoreBreakdown } from '@/lib/ai/scoring';
import type { ConnectionCandidate, CriticVerdict } from '@/lib/ai/types';

export interface GateResult {
  approved: boolean;
  score: number;
  status: 'APPROVED' | 'REJECTED' | 'BELOW_THRESHOLD';
  rejectionReason?: string;
}

/**
 * Final Quality Gate (item 30) — the single place that decides whether a connection is ever
 * shown. Nothing bypasses this: not a high score with a critic rejection, not a critic
 * approval with a low score. Both must pass.
 */
export function runQualityGate(candidate: ConnectionCandidate, critic: CriticVerdict): GateResult {
  const score = computeConnectionScore(candidate.scoreBreakdown as ScoreBreakdown);

  if (critic.verdict === 'REJECT') {
    return {
      approved: false,
      score,
      status: 'REJECTED',
      rejectionReason: `Critic rejected (Q${critic.failedQuestion}): ${critic.reason}`
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

  if (candidate.claimType !== 'FACT' && candidate.sources.every((s) => s.sourceType === 'USER_PROVIDED')) {
    return {
      approved: false,
      score,
      status: 'REJECTED',
      rejectionReason: 'No independent source backs this non-fact claim.'
    };
  }

  return { approved: true, score, status: 'APPROVED' };
}
