import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractedConcept, UserMemoryProfile } from './types';

// Stub only the model call; JSON parsing and everything else runs for real.
const routedComplete = vi.fn();
vi.mock('@/lib/ai/router', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/router')>('@/lib/ai/router');
  return { ...actual, routedComplete: (args: unknown) => routedComplete(args) };
});

const { findBridges } = await import('./bridgeEngine');

const concept: ExtractedConcept = {
  title: 'Heart chambers',
  summary: 'The human heart has four chambers.',
  atomLabel: '4 chambers',
  atomEmoji: '🫀',
  importance: 90,
  conceptType: 'DEFINITION',
  sourcePageNumbers: [1]
};

const profile: UserMemoryProfile = {
  preferredWorlds: ['FOOTBALL'],
  favoriteTeams: [],
  favoritePlayers: ['Star Striker'],
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

const reply = (obj: unknown) => ({ text: JSON.stringify(obj), model: 'stub', inputTokens: 0, outputTokens: 0, isMock: false });

const candidate = (worldRef: string, extra: Record<string, unknown> = {}) => ({
  anchor: '4',
  connectionType: 'NUMERIC',
  worldCategory: 'GENERAL_KNOWLEDGE',
  worldRef,
  atomEmoji: '🫀',
  bridgeLine: `4 ← ${worldRef}`,
  whyOneLiner: 'same count',
  evidence: `${worldRef} has 4 parts`,
  confidence: 0.95,
  relationDistance: 1,
  ...extra
});

const verdict = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  factTrue: true,
  linkTrue: true,
  forcedness: 'NATURAL',
  relationDistance: 1,
  coversMemoryTarget: true,
  scores: { connection: 90, simplicity: 90, memorability: 90, evidence: 90 },
  reason: 'ok',
  ...extra
});

describe('findBridges (anchor-first engine)', () => {
  beforeEach(() => routedComplete.mockReset());

  it('rejects false facts and forced links, keeps the real bridge, and never lets personalization rescue a weak one', async () => {
    routedComplete
      .mockResolvedValueOnce(
        reply({
          memoryTarget: '4 chambers',
          anchors: [{ text: '4', kind: 'NUMBER', relevance: 0.95 }],
          candidates: [
            candidate('Four Seasons'), // real, universal
            candidate('Made-up Band', { evidence: 'Made-up Band has 4 members' }), // verifier: false fact
            candidate('Star Striker', { connectionType: 'SPORTS', worldCategory: 'FOOTBALL', evidence: 'plays with heart' }), // forced
            candidate('Card Suits', { confidence: 0.3 }), // dropped before verification (low confidence)
            candidate('Weak Personal', { worldCategory: 'FOOTBALL' }) // passes gates, scores low
          ]
        })
      )
      .mockResolvedValueOnce(
        reply({
          verdicts: [
            verdict('r1c1'),
            verdict('r1c2', { factTrue: false, reason: 'wrong count' }),
            verdict('r1c3', { forcedness: 'FORCED', linkTrue: false }),
            verdict('r1c5', { scores: { connection: 50, simplicity: 60, memorability: 50, evidence: 60 } })
          ]
        })
      );

    const result = await findBridges(concept, profile, { userId: 'u1' });

    expect(result.rounds).toBe(1);
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Four Seasons']);
    expect(result.accepted[0]!.personalization).toBe(0);
    const reasons = Object.fromEntries(result.rejected.map((r) => [r.candidate.worldRef, r.reason]));
    expect(Object.keys(reasons).sort()).toEqual(['Card Suits', 'Made-up Band', 'Star Striker', 'Weak Personal']);
    expect(reasons['Weak Personal']).toMatch(/أقل من الحد/);

    // The verifier never receives the student's interests.
    const verifierCall = routedComplete.mock.calls[1]![0] as { messages: { content: string }[] };
    expect(JSON.stringify(verifierCall.messages)).not.toContain('FOOTBALL');
  });

  it('expands into a second round, told why round one failed, before giving up', async () => {
    routedComplete
      .mockResolvedValueOnce(reply({ memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Bad One')] }))
      .mockResolvedValueOnce(reply({ verdicts: [verdict('r1c1', { factTrue: false, reason: 'not true' })] }))
      .mockResolvedValueOnce(reply({ memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Good One')] }))
      .mockResolvedValueOnce(reply({ verdicts: [verdict('r2c1')] }));

    const result = await findBridges(concept, profile, { userId: 'u1' });

    expect(result.rounds).toBe(2);
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Good One']);
    const round2Prompt = (routedComplete.mock.calls[2]![0] as { messages: { content: string }[] }).messages[0]!.content;
    expect(round2Prompt).toContain('جولة توسيع'); // told why round one failed
    expect(round2Prompt).toMatch(/مراجع ممنوعة[^\n]*bad one/i); // and not allowed to retry it
  });

  it('adds at most 5 personalization points, only to a bridge that already passed', async () => {
    routedComplete
      .mockResolvedValueOnce(
        reply({
          memoryTarget: '4 chambers',
          anchors: [],
          candidates: [candidate('Star Striker', { worldCategory: 'FOOTBALL' }), candidate('Four Seasons')]
        })
      )
      .mockResolvedValueOnce(reply({ verdicts: [verdict('r1c1'), verdict('r1c2')] }));

    const result = await findBridges(concept, profile, { userId: 'u1' });
    const personal = result.accepted.find((a) => a.candidate.worldRef === 'Star Striker')!;
    expect(personal.personalization).toBeGreaterThan(0);
    expect(personal.personalization).toBeLessThanOrEqual(5);
    expect(personal.score - personal.baseScore).toBe(personal.personalization);
  });

  it('honestly returns nothing when no candidate survives either round', async () => {
    routedComplete
      .mockResolvedValueOnce(reply({ memoryTarget: 'x', anchors: [], candidates: [] }))
      .mockResolvedValueOnce(reply({ memoryTarget: 'x', anchors: [], candidates: [] }));

    const result = await findBridges(concept, profile, { userId: 'u1' });
    expect(result.accepted).toEqual([]);
    expect(result.rounds).toBe(2);
  });
});
