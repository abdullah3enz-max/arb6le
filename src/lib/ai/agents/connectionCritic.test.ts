import { describe, expect, it } from 'vitest';
import { normalizeVerdict } from './connectionCritic';

describe('normalizeVerdict', () => {
  it('treats anything the judge did not vouch for as the worst case', () => {
    const v = normalizeVerdict({ id: 'c1' })!;
    expect(v).toMatchObject({
      truthfulness: 0,
      hallucinationRisk: 10,
      twoSecondTest: false,
      obvious: false,
      forcedInterest: true,
      phoneticClear: false,
      rejectReason: null
    });
  });

  it('clamps scores and keeps only known reject reasons', () => {
    const v = normalizeVerdict({ id: 'c1', directness: 14, simplicity: -2, rejectReason: 'TOO_LONG' })!;
    expect(v.directness).toBe(10);
    expect(v.simplicity).toBe(0);
    expect(v.rejectReason).toBe('too_long');
    expect(normalizeVerdict({ id: 'c1', rejectReason: 'whatever' })!.rejectReason).toBeNull();
    expect(normalizeVerdict({ nope: true })).toBeNull();
  });
});
