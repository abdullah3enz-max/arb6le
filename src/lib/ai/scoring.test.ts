import { describe, expect, it } from 'vitest';
import { computeConnectionScore, passesThreshold } from './scoring';

describe('computeConnectionScore', () => {
  it('rejects a "clever" but slow-to-parse bridge in favor of an instant, direct one', () => {
    const instantDirect = computeConnectionScore({
      directness: 95,
      familiarity: 90,
      simplicity: 95,
      memorability: 70,
      relevance: 90,
      confusionRisk: 5
    });
    const cleverButSlow = computeConnectionScore({
      directness: 30,
      familiarity: 60,
      simplicity: 25,
      memorability: 90,
      relevance: 50,
      confusionRisk: 20
    });
    expect(instantDirect).toBeGreaterThan(cleverButSlow);
    expect(passesThreshold(instantDirect)).toBe(true);
    expect(passesThreshold(cleverButSlow)).toBe(false);
  });

  it('penalizes high confusion risk even when everything else scores well', () => {
    const confusing = computeConnectionScore({
      directness: 85,
      familiarity: 85,
      simplicity: 80,
      memorability: 80,
      relevance: 80,
      confusionRisk: 90
    });
    expect(passesThreshold(confusing)).toBe(false);
  });

  it('passes a genuinely direct-match bridge like "Ronaldo #7" for a 7 mg dose', () => {
    const score = computeConnectionScore({
      directness: 100,
      familiarity: 95,
      simplicity: 98,
      memorability: 85,
      relevance: 95,
      confusionRisk: 0
    });
    expect(passesThreshold(score)).toBe(true);
  });
});
