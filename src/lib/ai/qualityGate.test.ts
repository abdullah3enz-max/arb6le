import { describe, expect, it } from 'vitest';
import { runQualityGate } from './qualityGate';
import type { ConnectionCandidate, CriticVerdict } from './types';

function baseCandidate(overrides: Partial<ConnectionCandidate> = {}): ConnectionCandidate {
  return {
    type: 'CAUSE_EFFECT',
    worldCategory: 'FOOTBALL',
    worldRef: 'Real Madrid',
    headline: 'test',
    relationExplain: 'test relation',
    memoryHook: 'test hook',
    claimType: 'ANALOGY',
    sources: [{ sourceType: 'KNOWLEDGE_BASE', confidence: 0.9, evidenceSnippet: 'evidence' }],
    scoreBreakdown: {
      semanticRelevance: 90,
      factualAccuracy: 90,
      relationshipStrength: 90,
      memorability: 85,
      preferenceMatch: 80,
      contextMatch: 80,
      specificity: 85
    },
    ...overrides
  };
}

const approvingCritic: CriticVerdict = { verdict: 'APPROVE', reason: 'ok' };
const rejectingCritic: CriticVerdict = { verdict: 'REJECT', failedQuestion: 6, reason: 'hallucination suspected' };

describe('runQualityGate', () => {
  it('rejects even a high-scoring candidate if the Critic rejects it — critic and score both gate independently', () => {
    const result = runQualityGate(baseCandidate(), rejectingCritic);
    expect(result.approved).toBe(false);
    expect(result.status).toBe('REJECTED');
  });

  it('rejects a critic-approved candidate whose score is below threshold', () => {
    const weak = baseCandidate({
      scoreBreakdown: {
        semanticRelevance: 40,
        factualAccuracy: 40,
        relationshipStrength: 40,
        memorability: 40,
        preferenceMatch: 40,
        contextMatch: 40,
        specificity: 40
      }
    });
    const result = runQualityGate(weak, approvingCritic);
    expect(result.approved).toBe(false);
    expect(result.status).toBe('BELOW_THRESHOLD');
  });

  it('rejects a non-fact claim backed only by USER_PROVIDED sources even with a high score and critic approval', () => {
    const unbacked = baseCandidate({ sources: [{ sourceType: 'USER_PROVIDED', confidence: 1, evidenceSnippet: 'trust me' }] });
    const result = runQualityGate(unbacked, approvingCritic);
    expect(result.approved).toBe(false);
  });

  it('approves a high-score, critic-approved, independently-sourced candidate', () => {
    const result = runQualityGate(baseCandidate(), approvingCritic);
    expect(result.approved).toBe(true);
    expect(result.status).toBe('APPROVED');
  });
});
