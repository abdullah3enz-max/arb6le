import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterestFactRow } from './agents/interestRetriever';
import type { ExtractedConcept, UserMemoryProfile } from './types';

// Stub only the model call; JSON parsing, gates, scoring and ranking all run for real.
const routedComplete = vi.fn();
vi.mock('@/lib/ai/router', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/router')>('@/lib/ai/router');
  return { ...actual, routedComplete: (args: unknown) => routedComplete(args) };
});

const { findBridges } = await import('./bridgeEngine');

const concept = (atomLabel: string, summary: string, conceptType: ExtractedConcept['conceptType'] = 'DEFINITION'): ExtractedConcept => ({
  title: atomLabel,
  summary,
  atomLabel,
  atomEmoji: '🧂',
  importance: 90,
  conceptType,
  sourcePageNumbers: [1]
});
const SALT = concept('Salt', 'Salt is one of the oldest food preservatives.');
const DOSE = concept('7 mg', 'The usual dose is 7 mg.');
const HYPERTENSION = concept('Hypertension', 'Persistently high blood pressure.', 'TERMINOLOGY');

const emptyProfile: UserMemoryProfile = {
  preferredWorlds: [],
  favoriteTeams: [],
  favoritePlayers: [],
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
const footballFan: UserMemoryProfile = { ...emptyProfile, preferredWorlds: ['FOOTBALL'], favoritePlayers: ['Star Striker'] };
const animeFan: UserMemoryProfile = { ...emptyProfile, preferredWorlds: ['ANIME'], favoriteAnime: ['Pirate Show'] };

const strikerNumber: InterestFactRow = {
  id: 'f1',
  interest: 'Star Striker',
  worldCategory: 'FOOTBALL',
  kind: 'NUMBER',
  subject: 'Star Striker',
  attribute: 'shirt number',
  value: '7',
  shortForm: 'Striker #7',
  confidence: 0.98
};

type Agent = 'connection_finder' | 'phonetic_finder' | 'interest_finder' | 'connection_critic' | 'claim_checker';
const reply = (obj: unknown) => ({ text: JSON.stringify(obj), model: 'stub', inputTokens: 0, outputTokens: 0, isMock: false });

/** The discovery passes run in parallel, so the stub answers by agent name, in order per agent. */
function script(replies: Partial<Record<Agent, unknown[]>>) {
  const queues = Object.fromEntries(Object.entries(replies).map(([k, v]) => [k, [...v!]]));
  routedComplete.mockImplementation(async (args: { agent: Agent; messages: { content: string }[] }) => {
    const next = queues[args.agent]?.shift();
    if (next instanceof Error) throw next;
    if (next) return reply(next);
    if (args.agent === 'claim_checker') {
      // Unscripted: confirm every claim, so tests that aren't about fact-checking pass through.
      const claims = JSON.parse(args.messages[1]!.content) as { id: string }[];
      return reply({ results: claims.map((c) => ({ id: c.id, verdict: 'TRUE' })) });
    }
    return reply(args.agent === 'connection_critic' ? { verdicts: [] } : { candidates: [] });
  });
}
const callsFor = (agent: Agent) =>
  routedComplete.mock.calls
    .map((c) => c[0] as { agent: Agent; tier: string; messages: { content: string }[] })
    .filter((c) => c.agent === agent);

const cand = (worldRef: string, extra: Record<string, unknown> = {}) => ({
  anchor: 'Salt',
  connectionType: 'CONCEPTUAL',
  worldCategory: 'DAILY_LIFE',
  worldRef,
  atomEmoji: '🧂',
  bridgeLine: `Salt → ${worldRef}`,
  whyOneLiner: 'short',
  evidence: `${worldRef} is real`,
  confidence: 0.95,
  relationDistance: 1,
  ...extra
});

const verdict = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  directness: 9,
  familiarity: 9,
  memorability: 9,
  truthfulness: 10,
  simplicity: 9,
  hallucinationRisk: 0,
  twoSecondTest: true,
  coversFact: true,
  specific: true,
  obvious: true,
  forcedInterest: false,
  phoneticClear: true,
  rejectReason: null,
  reason: 'ok',
  ...extra
});

describe('core association engine', () => {
  beforeEach(() => {
    routedComplete.mockReset();
  });

  it('Salt → سلطة: the clear sound match wins; forced, long and number-shaped ones never get through', async () => {
    script({
      connection_finder: [
        {
          factType: 'ENGLISH_WORD',
          memoryTarget: 'Salt',
          anchors: [{ text: 'Salt', kind: 'TERM', relevance: 1 }],
          candidates: [
            cand('Famous Player', { connectionType: 'CHARACTER', worldCategory: 'FOOTBALL', bridgeLine: 'Salt → Famous Player' }),
            cand('Number Seven', { connectionType: 'NUMERIC', bridgeLine: 'Salt → 7' }), // no number in the fact
            cand('Long Story', {
              connectionType: 'CONCEPTUAL',
              bridgeLine: 'Salt reminds you of the old merchants who kept fish on long trips'
            })
          ]
        }
      ],
      phonetic_finder: [
        {
          candidates: [
            cand('سلطة', {
              connectionType: 'PHONETIC',
              bridgeLine: 'Salt → سلطة',
              soundsLike: 'سولت',
              matchedSound: 'سلط'
            })
          ]
        }
      ],
      connection_critic: [{ verdicts: [verdict('r1p1', { directness: 10, simplicity: 10 }), verdict('r1c1', { obvious: false, reason: 'possible, not obvious' })] }]
    });

    const result = await findBridges(SALT, emptyProfile, { userId: 'u1' });

    expect(result.factType).toBe('ENGLISH_WORD');
    expect(result.accepted.map((a) => a.candidate.bridgeLine)).toEqual(['Salt → سلطة']);
    const codes = Object.fromEntries(result.rejected.map((r) => [r.candidate.worldRef, r.code]));
    expect(codes).toEqual({ 'Number Seven': 'weak_relation', 'Long Story': 'too_long', 'Famous Player': 'weak_relation' });
    // Number-shaped and too-long candidates were stopped before costing a judge slot.
    const judged = callsFor('connection_critic')[0]!.messages[1]!.content;
    expect(judged).not.toContain('Number Seven');
    expect(judged).not.toContain('Long Story');
    // No interest pass for a student without interests.
    expect(callsFor('interest_finder')).toHaveLength(0);
  });

  it('7 mg → Striker #7: built straight from a retrieved, verified interest fact, not from model memory', async () => {
    script({
      connection_finder: [{ factType: 'NUMBER', memoryTarget: '7', anchors: [], candidates: [] }],
      connection_critic: [{ verdicts: [verdict('r1n1', { directness: 10, familiarity: 10, simplicity: 10, memorability: 10 })] }]
    });

    const result = await findBridges(DOSE, footballFan, { userId: 'u1', interestFacts: [strikerNumber] });

    const top = result.accepted[0]!;
    expect(top.candidate.bridgeLine).toBe('7 → Striker #7');
    expect(top.candidate.interestFactId).toBe('f1');
    expect(top.quality).toBeGreaterThanOrEqual(0.95);
    // The interests reach only the interest pass — never the general pass or the judge.
    expect(JSON.stringify(callsFor('connection_finder')[0]!.messages)).not.toContain('Star Striker');
    expect(JSON.stringify(callsFor('interest_finder')[0]!.messages)).toContain('Star Striker');
    const judged = JSON.parse(callsFor('connection_critic')[0]!.messages[1]!.content);
    expect(judged.candidates[0]).toMatchObject({ fromInterest: true, verifiedFact: true });
  });

  it('Hypertension → a favourite anime character just because the student likes it: rejected, honest empty result', async () => {
    script({
      interest_finder: [
        {
          candidates: [
            cand('Pirate Captain', {
              anchor: 'Hypertension',
              connectionType: 'CHARACTER',
              worldCategory: 'ANIME',
              bridgeLine: 'Hypertension → Pirate Captain'
            })
          ]
        }
      ],
      connection_critic: [{ verdicts: [verdict('r1i1', { forcedInterest: true, reason: 'only because they like the show' })] }]
    });

    const result = await findBridges(HYPERTENSION, animeFan, { userId: 'u1' });

    expect(result.accepted).toEqual([]);
    expect(result.rounds).toBe(2);
    expect(result.rejected.find((r) => r.candidate.worldRef === 'Pirate Captain')?.code).toBe('forced_interest');
    // Round 2 is told why round 1 failed.
    expect(callsFor('connection_finder')[1]!.messages[0]!.content).toMatch(/جولة توسيع[\s\S]*forced_interest/);
  });

  it('preference (20%) never rescues a weak association, but decides between two good ones', async () => {
    script({
      connection_finder: [{ factType: 'ENGLISH_WORD', memoryTarget: 'Salt', anchors: [], candidates: [cand('Sea Water', { connectionType: 'VISUAL' })] }],
      interest_finder: [
        {
          candidates: [
            cand('Pirate Show', { connectionType: 'SCENE', worldCategory: 'ANIME', bridgeLine: 'Salt → Pirate Show sea' }),
            cand('Pirate Show Cook', { connectionType: 'CHARACTER', worldCategory: 'ANIME', bridgeLine: 'Salt → the cook' })
          ]
        }
      ],
      connection_critic: [
        {
          verdicts: [
            verdict('r1c1', { directness: 8, familiarity: 9, memorability: 8, simplicity: 9 }), // general ≈ 0.88
            verdict('r1i1', { directness: 3, memorability: 4, simplicity: 5 }), // personal but weak ≈ 0.6
            verdict('r1i2', { directness: 8, familiarity: 8, memorability: 9, simplicity: 8 }) // personal, good ≈ 0.86
          ]
        }
      ]
    });

    const result = await findBridges(SALT, animeFan, { userId: 'u1' });

    // The weak personal one is rejected on quality alone, whatever the preference.
    expect(result.rejected.find((r) => r.candidate.worldRef === 'Pirate Show')?.quality).toBeLessThan(0.7);
    // Two good ones: the personal one earned its place and the 20% puts it first.
    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Pirate Show Cook', 'Sea Water']);
    for (const a of result.accepted) expect(a.final).toBeCloseTo(0.8 * a.quality + 0.2 * a.preference, 3);
  });

  it('one pass failing never loses the others; all failing is an error', async () => {
    script({
      connection_finder: [new Error('bad json')],
      phonetic_finder: [
        { candidates: [cand('سلطة', { connectionType: 'PHONETIC', bridgeLine: 'Salt → سلطة', soundsLike: 'سولت', matchedSound: 'سلط' })] }
      ],
      connection_critic: [{ verdicts: [verdict('r1p1')] }]
    });
    expect((await findBridges(SALT, emptyProfile, { userId: 'u1' })).accepted).toHaveLength(1);

    script({ connection_finder: [new Error('down')], phonetic_finder: [new Error('down')] });
    await expect(findBridges(SALT, emptyProfile, { userId: 'u1' })).rejects.toThrow('down');
  });

  it('the final fact check drops a passing but false claim, and the next confirmed one is shown', async () => {
    script({
      connection_finder: [
        {
          factType: 'ENGLISH_WORD',
          memoryTarget: 'Salt',
          anchors: [],
          candidates: [cand('Made-up Scene', { connectionType: 'SCENE', worldCategory: 'MOVIES' }), cand('Sea Water', { connectionType: 'VISUAL' })]
        }
      ],
      connection_critic: [{ verdicts: [verdict('r1c1', { directness: 10 }), verdict('r1c2', { directness: 8 })] }],
      claim_checker: [
        {
          results: [
            { id: 'r1c1', verdict: 'FALSE', note: 'that scene never happened' },
            { id: 'r1c2', verdict: 'TRUE' }
          ]
        }
      ]
    });

    const result = await findBridges(SALT, emptyProfile, { userId: 'u1' });

    expect(result.accepted.map((a) => a.candidate.worldRef)).toEqual(['Sea Water']);
    const dropped = result.rejected.find((r) => r.candidate.worldRef === 'Made-up Scene')!;
    expect(dropped.code).toBe('inaccurate');
    expect(dropped.reason).toContain('that scene never happened');
    // Checked by the independent judge tier, never the generating model.
    expect(callsFor('claim_checker')[0]!.tier).toBe('judge');
    expect(callsFor('connection_critic')[0]!.tier).toBe('judge');
  });

  it('"unsure" is not good enough: nothing confirmed means another round, then an honest empty result', async () => {
    script({
      connection_finder: [{ factType: 'ENGLISH_WORD', memoryTarget: 'Salt', anchors: [], candidates: [cand('Maybe True')] }],
      connection_critic: [{ verdicts: [verdict('r1c1')] }],
      claim_checker: [{ results: [{ id: 'r1c1', verdict: 'UNSURE' }] }]
    });

    const result = await findBridges(SALT, emptyProfile, { userId: 'u1' });

    expect(result.accepted).toEqual([]);
    expect(result.rounds).toBe(2);
    expect(result.rejected.find((r) => r.candidate.worldRef === 'Maybe True')?.code).toBe('hallucination_risk');
  });

  it('an association built in code from a verified interest fact skips the claim check', async () => {
    script({
      connection_finder: [{ factType: 'NUMBER', memoryTarget: '7', anchors: [], candidates: [] }],
      connection_critic: [{ verdicts: [verdict('r1n1')] }]
    });
    const result = await findBridges(DOSE, footballFan, { userId: 'u1', interestFacts: [strikerNumber] });
    expect(result.accepted).toHaveLength(1);
    expect(callsFor('claim_checker')).toHaveLength(0);
  });

  it('a student with no interests still gets the series/anime pass when there is series material', async () => {
    const seriesFact: InterestFactRow = { ...strikerNumber, id: 's1', interest: 'Some Series', worldCategory: 'SERIES', kind: 'CHARACTER', subject: 'Lead Detective', attribute: 'role', value: 'detective', shortForm: 'the detective' };
    script({});
    await findBridges(SALT, emptyProfile, { userId: 'u1', interestFacts: [seriesFact] });
    const prompt = callsFor('interest_finder')[0]!.messages[1]!.content;
    expect(prompt).toContain('Lead Detective');
    expect(prompt).toContain('المسلسلات والأنمي أولوية');
  });
});

