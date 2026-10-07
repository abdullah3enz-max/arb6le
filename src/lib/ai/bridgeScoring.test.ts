import { describe, expect, it } from 'vitest';
import {
  QUALITY_THRESHOLD,
  confidenceLabel,
  finalScore,
  gateVerdict,
  lowQualityReason,
  preGate,
  preference,
  quality,
  wordCount
} from './bridgeScoring';
import type { BridgeCandidate, BridgeVerdict, UserMemoryProfile } from './types';

const candidate = (extra: Partial<BridgeCandidate> = {}): BridgeCandidate => ({
  id: 'c1',
  anchor: '7',
  connectionType: 'NUMERIC',
  worldCategory: 'FOOTBALL',
  worldRef: 'Cristiano Ronaldo',
  atomEmoji: '💊',
  bridgeLine: '7 mg → Ronaldo #7',
  whyOneLiner: 'his shirt number',
  evidence: 'Ronaldo wears 7',
  confidence: 0.95,
  relationDistance: 1,
  ...extra
});

const verdict = (extra: Partial<BridgeVerdict> = {}): BridgeVerdict => ({
  id: 'c1',
  directness: 9,
  familiarity: 9,
  memorability: 9,
  truthfulness: 10,
  simplicity: 9,
  hallucinationRisk: 0,
  twoSecondTest: true,
  obvious: true,
  forcedInterest: false,
  phoneticClear: true,
  rejectReason: null,
  reason: 'ok',
  ...extra
});

const profile: UserMemoryProfile = {
  preferredWorlds: ['FOOTBALL'],
  favoriteTeams: [],
  favoritePlayers: ['Cristiano Ronaldo'],
  favoriteShows: [],
  favoriteMovies: [],
  favoriteAnime: [],
  favoriteGames: [],
  favoriteCars: [],
  favoriteMusic: [],
  favoritePeople: [],
  connectionStyles: [],
  weights: {}
};

describe('preGate (no model needed)', () => {
  it('passes a one-glance number association whose number is in the fact', () => {
    expect(preGate(candidate(), 'Dose = 7 mg')).toBeNull();
  });

  it('rejects a number association whose number is not in the fact', () => {
    expect(preGate(candidate({ bridgeLine: '10 → Messi #10', anchor: '10' }), 'Dose = 7 mg')?.code).toBe('inaccurate');
  });

  it('rejects a line that needs reading instead of a glance', () => {
    const long = '7 mg can be remembered by imagining Cristiano Ronaldo scoring seven goals';
    expect(preGate(candidate({ bridgeLine: long }), '7 mg')?.code).toBe('too_long');
  });

  it('allows MINI_STORY one short sentence, never a story', () => {
    const one = candidate({ connectionType: 'MINI_STORY', bridgeLine: 'الملح حارس الأكل من أيام الأجداد' });
    expect(preGate(one, 'Salt')).toBeNull();
    const story = candidate({
      connectionType: 'MINI_STORY',
      bridgeLine: 'كان فيه تاجر قديم. حط الملح على السمك. وصل السمك سليم بعد أسابيع من السفر الطويل'
    });
    expect(preGate(story, 'Salt')?.code).toBe('too_long');
  });

  it('rejects a sound-alike claim without the two sounds to compare', () => {
    expect(preGate(candidate({ connectionType: 'PHONETIC', bridgeLine: 'Salt → سلطة' }), 'Salt')?.code).toBe('weak_relation');
    const ok = candidate({
      connectionType: 'PHONETIC',
      bridgeLine: 'Salt → سلطة',
      phonetic: { term: 'Salt', soundsLike: 'سولت', matchedSound: 'سلط' }
    });
    expect(preGate(ok, 'Salt')).toBeNull();
  });

  it('counts words without the arrow', () => {
    expect(wordCount('7 mg → Ronaldo #7')).toBe(4);
  });
});

describe('gateVerdict (the judge’s hard gates)', () => {
  it('passes a clean verdict', () => {
    expect(gateVerdict(candidate(), verdict())).toBeNull();
  });

  it.each([
    [{ truthfulness: 6 }, 'inaccurate'],
    [{ hallucinationRisk: 5 }, 'hallucination_risk'],
    [{ twoSecondTest: false }, 'requires_explanation'],
    [{ obvious: false }, 'weak_relation'],
    [{ rejectReason: 'obscure_reference' as const }, 'obscure_reference']
  ])('rejects %o as %s', (v, code) => {
    expect(gateVerdict(candidate(), verdict(v))?.code).toBe(code);
  });

  it('rejects a forced interest only when it came from the interests', () => {
    expect(gateVerdict(candidate({ fromInterest: true }), verdict({ forcedInterest: true }))?.code).toBe('forced_interest');
    expect(gateVerdict(candidate({ fromInterest: false }), verdict({ forcedInterest: true }))).toBeNull();
  });

  it('rejects an unclear sound match', () => {
    const c = candidate({ connectionType: 'PHONETIC', phonetic: { term: 'Vinegar', soundsLike: 'فينيقر', matchedSound: 'في' } });
    expect(gateVerdict(c, verdict({ phoneticClear: false }))?.code).toBe('weak_relation');
  });
});

describe('quality, preference and the 80/20 rank', () => {
  it('maps judge scores to 0-1 quality, with the confidence bands', () => {
    expect(quality(verdict())).toBeCloseTo(0.92, 2);
    expect(confidenceLabel(0.96)).toBe('ممتاز');
    expect(confidenceLabel(0.86)).toBe('قوي');
    expect(confidenceLabel(0.76)).toBe('مقبول');
  });

  it('names the weakest score when quality is too low', () => {
    expect(lowQualityReason(verdict({ familiarity: 2 }))).toBe('obscure_reference');
    expect(lowQualityReason(verdict({ simplicity: 1 }))).toBe('confusing');
  });

  it('preference is 0-1 and only worth 20%', () => {
    const p = preference(candidate(), profile, 'NUMBER');
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThanOrEqual(1);
    expect(finalScore(0.9, 0)).toBeCloseTo(0.72, 3);
    expect(finalScore(0.9, 1)).toBeCloseTo(0.92, 3);
  });

  it('a general association beats a much weaker personal one, a close personal one wins', () => {
    const general = finalScore(0.95, 0);
    expect(finalScore(0.7, 1)).toBeLessThanOrEqual(general);
    expect(finalScore(0.9, 0.85)).toBeGreaterThan(general);
  });

  it('the student’s 👎 history on a type lowers its preference', () => {
    const disliked = { ...profile, weights: { 'association_type:numeric': -30 } };
    expect(preference(candidate(), disliked, 'NUMBER')).toBeLessThan(preference(candidate(), profile, 'NUMBER'));
  });

  it('threshold is 0.70 by default', () => {
    expect(QUALITY_THRESHOLD).toBe(0.7);
  });
});
