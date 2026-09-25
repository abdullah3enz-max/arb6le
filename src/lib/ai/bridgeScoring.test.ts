import { describe, expect, it } from 'vitest';
import { baseScore, BRIDGE_SCORE_THRESHOLD, gateVerdict, personalizationBonus } from './bridgeScoring';
import type { BridgeCandidate, BridgeVerdict, UserMemoryProfile } from './types';

function verdict(overrides: Partial<BridgeVerdict> = {}): BridgeVerdict {
  return {
    id: 'c1',
    factTrue: true,
    linkTrue: true,
    forcedness: 'NATURAL',
    relationDistance: 1,
    coversMemoryTarget: true,
    scores: { connection: 90, simplicity: 90, memorability: 90, evidence: 90 },
    reason: 'ok',
    ...overrides
  };
}

function candidate(overrides: Partial<BridgeCandidate> = {}): BridgeCandidate {
  return {
    id: 'c1',
    anchor: '7',
    connectionType: 'NUMERIC',
    worldCategory: 'FOOTBALL',
    worldRef: 'Some Player',
    atomEmoji: '💉',
    bridgeLine: '7 ← X',
    whyOneLiner: '',
    evidence: 'X is 7',
    confidence: 0.95,
    relationDistance: 1,
    ...overrides
  };
}

const profile: UserMemoryProfile = {
  preferredWorlds: ['FOOTBALL', 'SERIES'],
  favoriteTeams: [],
  favoritePlayers: ['Some Player'],
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

describe('gateVerdict', () => {
  it('passes a natural, true, direct bridge', () => {
    expect(gateVerdict(verdict())).toBeNull();
  });

  it('rejects a false fact however well it scores', () => {
    expect(gateVerdict(verdict({ factTrue: false }))).not.toBeNull();
  });

  it('rejects forced and far-fetched bridges', () => {
    expect(gateVerdict(verdict({ forcedness: 'FORCED' }))).not.toBeNull();
    expect(gateVerdict(verdict({ relationDistance: 5 }))).not.toBeNull();
  });
});

describe('baseScore', () => {
  it('penalizes a bridge that misses the part of the fact the student must remember', () => {
    expect(baseScore(verdict({ coversMemoryTarget: false }))).toBeLessThan(baseScore(verdict()));
  });

  it('prefers a 1-step bridge over a 3-step one', () => {
    expect(baseScore(verdict({ relationDistance: 3 }))).toBeLessThan(baseScore(verdict({ relationDistance: 1 })));
  });
});

describe('personalizationBonus', () => {
  it('never exceeds 5 points', () => {
    expect(personalizationBonus(candidate(), { ...profile, weights: { 'world:football': 50 } })).toBe(5);
  });

  it('is 0 for a reference outside every interest', () => {
    expect(personalizationBonus(candidate({ worldCategory: 'DAILY_LIFE', worldRef: 'A kettle' }), profile)).toBe(0);
  });

  it('cannot lift a weak bridge over the threshold on its own', () => {
    const weak = baseScore(verdict({ scores: { connection: 50, simplicity: 60, memorability: 50, evidence: 60 } }));
    expect(weak).toBeLessThan(BRIDGE_SCORE_THRESHOLD);
    expect(weak + personalizationBonus(candidate(), profile)).toBeLessThan(BRIDGE_SCORE_THRESHOLD);
  });
});
