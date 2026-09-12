import { describe, expect, it } from 'vitest';
import { computeConnectionScore, passesThreshold } from './scoring';

describe('computeConnectionScore', () => {
  it('weighs factual accuracy and relationship strength above memorability', () => {
    const highFactLow_Memorable = computeConnectionScore({
      semanticRelevance: 50,
      factualAccuracy: 100,
      relationshipStrength: 100,
      memorability: 20,
      preferenceMatch: 50,
      contextMatch: 50,
      specificity: 50
    });
    const lowFactHighMemorable = computeConnectionScore({
      semanticRelevance: 50,
      factualAccuracy: 20,
      relationshipStrength: 20,
      memorability: 100,
      preferenceMatch: 50,
      contextMatch: 50,
      specificity: 50
    });
    expect(highFactLow_Memorable).toBeGreaterThan(lowFactHighMemorable);
  });

  it('rejects a superficial "القلب مثل حارس المرمى" style connection: high memorability/preference but low relationship strength and specificity stays below threshold', () => {
    const score = computeConnectionScore({
      semanticRelevance: 40,
      factualAccuracy: 60,
      relationshipStrength: 25,
      memorability: 90,
      preferenceMatch: 90,
      contextMatch: 40,
      specificity: 20
    });
    expect(passesThreshold(score)).toBe(false);
  });

  it('passes a specific, factually accurate, high-relationship-strength connection', () => {
    const score = computeConnectionScore({
      semanticRelevance: 90,
      factualAccuracy: 95,
      relationshipStrength: 92,
      memorability: 80,
      preferenceMatch: 70,
      contextMatch: 80,
      specificity: 88
    });
    expect(passesThreshold(score)).toBe(true);
  });
});
