import { db } from '@/lib/db';
import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { normalizeRef } from '@/lib/ai/bridgeScoring';
import type { UserMemoryProfile, WorldCategory } from '@/lib/ai/types';

/*
 * RETRIEVAL — separate from generation. Before any association is generated, each of the
 * student's named interests gets a small store of facts about it (characters, actors, roles,
 * famous objects, places, events, abilities, numbers, quotes, relationships). Each fact list is
 * produced once, then checked by a separate strict call at temperature 0, and only facts that
 * call confirms are kept. The store is shared by every student and reused for every document.
 *
 * There is no external knowledge API configured, so "verified" here means "confirmed by an
 * independent, strict model call" — stronger than trusting the generator's memory mid-association,
 * but not a database lookup. Swap retrieveFacts() for a real source when one is available.
 */

export interface InterestFactRow {
  id: string;
  interest: string;
  worldCategory: WorldCategory;
  kind: string;
  subject: string;
  attribute: string;
  value: string;
  shortForm: string;
  confidence: number;
}

const FACT_KINDS = ['NUMBER', 'CHARACTER', 'ACTOR', 'ROLE', 'OBJECT', 'LOCATION', 'EVENT', 'ABILITY', 'QUOTE', 'RELATION'];
const MAX_INTERESTS = 12;
const MIN_CONFIDENCE = 0.8;
/** Facts about a living person/team (shirt numbers, clubs) go stale — refresh periodically. */
const REFRESH_DAYS = 90;

export function interestsOf(profile: UserMemoryProfile): { name: string; world: WorldCategory }[] {
  const lists: [string[], WorldCategory][] = [
    [profile.favoritePlayers, 'FOOTBALL'],
    [profile.favoriteTeams, 'FOOTBALL'],
    [profile.favoriteShows, 'SERIES'],
    [profile.favoriteMovies, 'MOVIES'],
    [profile.favoriteAnime, 'ANIME'],
    [profile.favoriteGames, 'GAMES'],
    [profile.favoriteCars, 'CARS'],
    [profile.favoriteMusic, 'MUSIC'],
    [profile.favoritePeople, 'PEOPLE']
  ];
  const seen = new Set<string>();
  const out: { name: string; world: WorldCategory }[] = [];
  for (const [names, world] of lists) {
    for (const name of names) {
      const key = normalizeRef(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ name, world });
    }
  }
  return out.slice(0, MAX_INTERESTS);
}

const RETRIEVE_PROMPT =
  '[AGENT:interest_retriever] اكتب حقائق مشهورة وقابلة للتحقق عن اهتمام واحد (شخص، فريق، مسلسل، ' +
  'فيلم، أنمي، لعبة، سيارة، فنان). أنواع الحقائق: NUMBER (رقم قميص، عدد، سنة، رقم مشهور)، CHARACTER ' +
  '(شخصيات رئيسية)، ACTOR، ROLE، OBJECT (أغراض مشهورة)، LOCATION، EVENT (أحداث مشهورة)، ABILITY ' +
  '(قوى/مهارات)، QUOTE (عبارات مشهورة)، RELATION (علاقات بين الشخصيات).\n' +
  '- فقط الحقائق اللي أي متابع يعرفها فورًا، وأنت متأكد منها حرفيًا. لا تخمّن أبدًا — الأقل والأصح أفضل.\n' +
  '- 10 إلى 20 حقيقة. shortForm = صيغة قصيرة جدًا للعرض (3 كلمات بالكثير).\n' +
  'أرجع JSON فقط: {"facts":[{"kind":"...","subject":"...","attribute":"...","value":"...",' +
  '"shortForm":"...","confidence":0.0}]}';

const VERIFY_PROMPT =
  '[AGENT:interest_verifier] أنت مدقق حقائق صارم ومستقل. لكل حقيقة: true فقط إذا أنت متأكد إنها ' +
  'صحيحة حرفيًا ومشهورة (الأرقام والأسماء بالضبط). أي شك = false. ' +
  'أرجع JSON فقط: {"results":[{"i":0,"true":true}]}';

interface RawFact {
  kind?: unknown;
  subject?: unknown;
  attribute?: unknown;
  value?: unknown;
  shortForm?: unknown;
  confidence?: unknown;
}

async function retrieveFacts(interest: { name: string; world: WorldCategory }, userId: string) {
  const generated = await routedComplete({
    tier: 'strong',
    agent: 'interest_retriever',
    userId,
    responseFormat: 'json',
    temperature: 0.2,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: RETRIEVE_PROMPT },
      { role: 'user', content: `الاهتمام: ${interest.name} (${interest.world})` }
    ]
  });
  if (generated.isMock) return null;

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
  const facts = (parseJsonResponse<{ facts?: RawFact[] }>(generated.text).facts ?? [])
    .map((f) => ({
      kind: str(f.kind).toUpperCase(),
      subject: str(f.subject) || interest.name,
      attribute: str(f.attribute),
      value: str(f.value),
      shortForm: str(f.shortForm),
      confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0))
    }))
    .filter((f) => FACT_KINDS.includes(f.kind) && f.value && f.shortForm && f.confidence >= MIN_CONFIDENCE);
  if (facts.length === 0) return [];

  const verified = await routedComplete({
    tier: 'strong',
    agent: 'interest_verifier',
    userId,
    responseFormat: 'json',
    temperature: 0,
    maxTokens: 2048,
    messages: [
      { role: 'system', content: VERIFY_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(
          facts.map((f, i) => ({ i, subject: f.subject, attribute: f.attribute, value: f.value }))
        )
      }
    ]
  });
  const confirmed = new Set(
    (parseJsonResponse<{ results?: { i?: unknown; true?: unknown }[] }>(verified.text).results ?? [])
      .filter((r) => r.true === true)
      .map((r) => Number(r.i))
  );
  return facts.filter((_, i) => confirmed.has(i));
}

/**
 * Makes sure every named interest of this student has been retrieved (once, shared), then
 * returns all stored facts for them. Never throws: a failed retrieval just means fewer facts.
 */
export async function loadInterestFacts(profile: UserMemoryProfile, userId: string): Promise<InterestFactRow[]> {
  const interests = interestsOf(profile);
  if (interests.length === 0) return [];
  const keys = interests.map((i) => normalizeRef(i.name));

  try {
    const fresh = await db.interestRetrieval.findMany({
      where: { interestKey: { in: keys }, retrievedAt: { gte: new Date(Date.now() - REFRESH_DAYS * 86_400_000) } }
    });
    const done = new Set(fresh.map((r) => r.interestKey));
    const missing = interests.filter((i) => !done.has(normalizeRef(i.name)));

    // A few at a time: a provider still has a requests-per-minute ceiling.
    for (let i = 0; i < missing.length; i += 3) {
      await Promise.all(
        missing.slice(i, i + 3).map(async (interest) => {
          try {
            const facts = await retrieveFacts(interest, userId);
            if (facts === null) return; // mock provider — nothing real to store
            const interestKey = normalizeRef(interest.name);
            await db.$transaction([
              db.interestFact.deleteMany({ where: { interestKey } }),
              db.interestFact.createMany({
                data: facts.map((f) => ({ ...f, interestKey, interest: interest.name, worldCategory: interest.world }))
              }),
              db.interestRetrieval.upsert({
                where: { interestKey },
                create: { interestKey, interest: interest.name, factCount: facts.length },
                update: { factCount: facts.length, retrievedAt: new Date() }
              })
            ]);
          } catch (error) {
            console.error('Interest retrieval failed (non-fatal):', interest.name, error);
          }
        })
      );
    }

    return await db.interestFact.findMany({
      where: { interestKey: { in: keys } },
      select: {
        id: true,
        interest: true,
        worldCategory: true,
        kind: true,
        subject: true,
        attribute: true,
        value: true,
        shortForm: true,
        confidence: true
      }
    });
  } catch (error) {
    console.error('Interest fact store unavailable (non-fatal):', error);
    return [];
  }
}
