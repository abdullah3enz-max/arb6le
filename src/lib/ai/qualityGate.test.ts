import { describe, expect, it } from 'vitest';
import { runQualityGate } from './qualityGate';
import type { ConnectionCandidate, CriticVerdict } from './types';

function baseCandidate(overrides: Partial<ConnectionCandidate> = {}): ConnectionCandidate {
  return {
    associationLevel: 'DIRECT_MATCH',
    worldCategory: 'FOOTBALL',
    worldRef: 'Cristiano Ronaldo',
    atomEmoji: '💉',
    atomLabel: '7 mg',
    bridgeLine: 'Ronaldo = 7',
    whyOneLiner: 'رونالدو اشتهر بالرقم 7.',
    claimType: 'FACT',
    sources: [{ sourceType: 'KNOWLEDGE_BASE', confidence: 0.95, evidenceSnippet: 'Ronaldo wears jersey #7' }],
    scoreBreakdown: {
      directness: 95,
      familiarity: 90,
      simplicity: 95,
      memorability: 80,
      relevance: 90,
      confusionRisk: 5
    },
    ...overrides
  };
}

const approvingCritic: CriticVerdict = { verdict: 'APPROVE', reason: 'ok' };
const rejectingCritic: CriticVerdict = { verdict: 'REJECT', failedCheck: 'hallucination', reason: 'invented detail' };

describe('runQualityGate', () => {
  it('rejects even a high-scoring candidate if the Critic rejects it — critic and score both gate independently', () => {
    const result = runQualityGate(baseCandidate(), rejectingCritic);
    expect(result.approved).toBe(false);
    expect(result.status).toBe('REJECTED');
  });

  it('rejects a critic-approved candidate whose score is below threshold (slow/indirect bridge)', () => {
    const weak = baseCandidate({
      scoreBreakdown: {
        directness: 30,
        familiarity: 40,
        simplicity: 25,
        memorability: 50,
        relevance: 40,
        confusionRisk: 30
      }
    });
    const result = runQualityGate(weak, approvingCritic);
    expect(result.approved).toBe(false);
    expect(result.status).toBe('BELOW_THRESHOLD');
  });

  it('rejects a bridge backed only by USER_PROVIDED sources even with a high score and critic approval', () => {
    const unbacked = baseCandidate({ sources: [{ sourceType: 'USER_PROVIDED', confidence: 1, evidenceSnippet: 'trust me' }] });
    const result = runQualityGate(unbacked, approvingCritic);
    expect(result.approved).toBe(false);
  });

  it('approves a high-score, critic-approved, independently-sourced direct-match bridge', () => {
    const result = runQualityGate(baseCandidate(), approvingCritic);
    expect(result.approved).toBe(true);
    expect(result.status).toBe('APPROVED');
  });
});
