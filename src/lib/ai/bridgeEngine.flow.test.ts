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

type Agent = 'connection_finder' | 'sound_screen_finder' | 'connection_critic';
/** Discovery passes run in parallel, so answer by agent name, in order per agent. */
function script(replies: Partial<Record<Agent, unknown[]>>) {
  const queues = Object.fromEntries(Object.entries(replies).map(([k, v]) => [k, [...v!]]));
  routedComplete.mockImplementation(async (args: { agent: Agent }) => {
    const next = queues[args.agent]?.shift();
    if (next instanceof Error) throw next;
    return reply(next ?? (args.agent === 'connection_critic' ? { verdicts: [] } : { candidates: [] }));
  });
}
const callsFor = (agent: Agent) =>
  routedComplete.mock.calls.map((c) => c[0] as { agent: Agent; messages: { content: string }[] }).filter((c) => c.agent === agent);

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
  beforeEach(() => {
    routedComplete.mockReset();
  });

  it('rejects false facts and forced links, keeps the real bridge, and never lets personalization rescue a weak one', async () => {
    script({
      connection_finder: [
        {
          memoryTarget: '4 chambers',
          anchors: [{ text: '4', kind: 'NUMBER', relevance: 0.95 }],
          candidates: [
            candidate('Four Seasons'), // real, universal
            candidate('Made-up Band', { evidence: 'Made-up Band has 4 members' }), // verifier: false fact
            candidate('Star Striker', { connectionType: 'SPORTS', worldCategory: 'FOOTBALL', evidence: 'plays with heart' }), // forced
            candidate('Card Suits', { confidence: 0.3 }), // dropped before verification (low confidence)
            candidate('Weak Personal', { worldCategory: 'FOOTBALL' }) // passes gates, scores low
          ]
        }
      ],
      connection_critic: [
        {
          verdicts: [
            verdict('r1c1'),
            verdict('r1c2', { factTrue: false, reason: 'wrong count' }),
            verdict('r1c3', { forcedness: 'FORCED', linkTrue: false }),
            verdict('r1c5', { scores: { connection: 50, simplicity: 60, memorability: 50, evidence: 60 } })
          ]
        }
      ]
    });

    const result = await findBridges(concept, profile, { userId: 'u1' });

    expect(result.rounds).toBe(1);
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Four Seasons']);
    expect(result.accepted[0]!.personalization).toBe(0);
    const reasons = Object.fromEntries(result.rejected.map((r) => [r.candidate.worldRef, r.reason]));
    expect(Object.keys(reasons).sort()).toEqual(['Card Suits', 'Made-up Band', 'Star Striker', 'Weak Personal']);
    expect(reasons['Weak Personal']).toMatch(/أقل من الحد/);

    // The verifier never receives the student's interests.
    expect(JSON.stringify(callsFor('connection_critic')[0]!.messages)).not.toContain('FOOTBALL');
    expect(JSON.stringify(callsFor('sound_screen_finder')[0]!.messages)).not.toContain('Star Striker');
  });

  it('expands into a second round, told why round one failed, before giving up', async () => {
    script({
      connection_finder: [
        { memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Bad One')] },
        { memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Good One')] }
      ],
      connection_critic: [
        { verdicts: [verdict('r1c1', { factTrue: false, reason: 'not true' })] },
        { verdicts: [verdict('r2c1')] }
      ]
    });

    const result = await findBridges(concept, profile, { userId: 'u1' });

    expect(result.rounds).toBe(2);
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Good One']);
    const round2Prompt = callsFor('connection_finder')[1]!.messages[0]!.content;
    expect(round2Prompt).toContain('جولة توسيع'); // told why round one failed
    expect(round2Prompt).toMatch(/مراجع ممنوعة[^\n]*bad one/i); // and not allowed to retry it
  });

  it('adds at most 5 personalization points, only to a bridge that already passed', async () => {
    script({
      connection_finder: [
        {
          memoryTarget: '4 chambers',
          anchors: [],
          candidates: [candidate('Star Striker', { worldCategory: 'FOOTBALL' }), candidate('Four Seasons')]
        }
      ],
      connection_critic: [{ verdicts: [verdict('r1c1'), verdict('r1c2')] }]
    });

    const result = await findBridges(concept, profile, { userId: 'u1' });
    const personal = result.accepted.find((a) => a.candidate.worldRef === 'Star Striker')!;
    expect(personal.personalization).toBeGreaterThan(0);
    expect(personal.personalization).toBeLessThanOrEqual(5);
    expect(personal.score - personal.baseScore).toBe(personal.personalization + personal.domainBonus);
  });

  it('honestly returns nothing when no candidate survives either round', async () => {
    script({});

    const result = await findBridges(concept, profile, { userId: 'u1' });
    expect(result.accepted).toEqual([]);
    expect(result.rounds).toBe(2);
  });

  it('runs the sound & screen pass: sound-alike and series/anime bridges reach the verifier and win ties', async () => {
    script({
      connection_finder: [{ memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Four Seasons')] }],
      sound_screen_finder: [
        {
          candidates: [
            candidate('Quad Squad (Some Anime)', {
              anchor: 'chambers',
              connectionType: 'PHONETIC',
              worldCategory: 'ANIME',
              soundsLike: 'تشيمبرز',
              matchedSound: 'تشيمبر'
            }),
            // A sound-alike claim with no sounds to compare is unverifiable — never sent.
            candidate('No Sounds Given', { connectionType: 'PHONETIC', worldCategory: 'SERIES' })
          ]
        }
      ],
      connection_critic: [{ verdicts: [verdict('r1c1'), verdict('r1s1')] }]
    });

    const result = await findBridges(concept, profile, { userId: 'u1' });

    // Same verifier scores, but the anime sound-alike is preferred (domain bonus, capped at 5).
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Quad Squad (Some Anime)', 'Four Seasons']);
    expect(result.accepted[0]!.domainBonus).toBe(5);
    expect(result.accepted[1]!.domainBonus).toBe(0);
    expect(result.accepted[0]!.candidate.phonetic).toEqual({ term: 'chambers', soundsLike: 'تشيمبرز', matchedSound: 'تشيمبر' });

    const verifierInput = callsFor('connection_critic')[0]!.messages[1]!.content;
    expect(verifierInput).toContain('matchedSound');
    expect(verifierInput).not.toContain('No Sounds Given');
  });

  it('keeps the general pass when the sound & screen pass fails, and vice versa', async () => {
    script({
      connection_finder: [{ memoryTarget: '4 chambers', anchors: [], candidates: [candidate('Four Seasons')] }],
      sound_screen_finder: [new Error('bad json')],
      connection_critic: [{ verdicts: [verdict('r1c1')] }]
    });
    expect((await findBridges(concept, profile, { userId: 'u1' })).accepted).toHaveLength(1);

    script({
      connection_finder: [new Error('bad json')],
      sound_screen_finder: [{ candidates: [candidate('Some Series Family', { worldCategory: 'SERIES' })] }],
      connection_critic: [{ verdicts: [verdict('r1s1')] }]
    });
    expect((await findBridges(concept, profile, { userId: 'u1' })).accepted).toHaveLength(1);

    script({ connection_finder: [new Error('down')], sound_screen_finder: [new Error('down')] });
    await expect(findBridges(concept, profile, { userId: 'u1' })).rejects.toThrow('down');
  });
});
