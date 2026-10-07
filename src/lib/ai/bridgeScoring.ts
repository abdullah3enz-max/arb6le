import type { BridgeCandidate, BridgeVerdict, FactType, RejectReason, UserMemoryProfile } from './types';

/*
 * ERBOTLI does not generate connections because they are possible. It generates them only when
 * they are obvious, truthful, short, memorable and useful. Everything below enforces that:
 *   1. deterministic pre-gates (length, real number, sound pair) — before any judging;
 *   2. the judge's hard gates (truth, hallucination, 2-second test, obviousness, forced interest);
 *   3. a quality threshold on the judge's scores alone;
 *   4. only then personal preference (20%) — it reorders good associations, never rescues one.
 */

/** Minimum association quality (0-1). Below it: NO STRONG ASSOCIATION FOUND. */
export const QUALITY_THRESHOLD = Number(process.env.ASSOCIATION_QUALITY_THRESHOLD ?? 0.7);
export const QUALITY_WEIGHT = 0.8;
export const PREFERENCE_WEIGHT = 0.2;

/** "One glance": the whole association line. */
export const MAX_LINK_WORDS = 7;
export const MAX_LINK_CHARS = 48;
/** MINI_STORY (last resort): one very short sentence. */
export const MAX_STORY_WORDS = 14;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w && !/^[→←=\-–—:|]+$/.test(w)).length;
}

export function numbersIn(text: string): string[] {
  const western = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return [...new Set(western.match(/\d+(?:\.\d+)?/g) ?? [])];
}

/**
 * Checks that need no model: a too-long line, a NUMERIC association whose number isn't in the
 * fact, a sound-alike without the two sounds to compare. Returns the reject code or null.
 */
export function preGate(candidate: BridgeCandidate, factText: string): { code: RejectReason; message: string } | null {
  const line = candidate.bridgeLine;
  if (candidate.connectionType === 'MINI_STORY') {
    const sentences = line.split(/[.!؟?]\s+/).filter((s) => s.trim()).length;
    if (wordCount(line) > MAX_STORY_WORDS || sentences > 1)
      return { code: 'too_long', message: `قصة أطول من جملة قصيرة (${wordCount(line)} كلمة)` };
  } else if (wordCount(line) > MAX_LINK_WORDS || line.length > MAX_LINK_CHARS) {
    return { code: 'too_long', message: `الرابط طويل (${wordCount(line)} كلمات) — لازم يُفهم بنظرة` };
  }

  if (candidate.connectionType === 'NUMERIC') {
    const factNumbers = new Set(numbersIn(factText));
    const shared = numbersIn(`${candidate.anchor} ${line}`).some((n) => factNumbers.has(n));
    if (!shared) return { code: 'inaccurate', message: 'ربط رقمي برقم مو موجود في المعلومة' };
  }

  if (candidate.connectionType === 'PHONETIC' && !candidate.phonetic)
    return { code: 'weak_relation', message: 'تشابه صوتي بدون النطقين للمقارنة' };

  return null;
}

/** The judge's hard gates: any failure rejects, whatever the scores say. */
export function gateVerdict(c: BridgeCandidate, v: BridgeVerdict): { code: RejectReason; message: string } | null {
  if (v.truthfulness < 8) return { code: 'inaccurate', message: `معلومة غير مؤكدة: ${v.reason}` };
  if (v.hallucinationRisk >= 4) return { code: 'hallucination_risk', message: `احتمال هلوسة: ${v.reason}` };
  if (c.fromInterest && v.forcedInterest) return { code: 'forced_interest', message: `اهتمام مُقحم: ${v.reason}` };
  if (c.connectionType === 'PHONETIC' && !v.phoneticClear)
    return { code: 'weak_relation', message: `التشابه الصوتي مو واضح: ${v.reason}` };
  if (!v.twoSecondTest) return { code: 'requires_explanation', message: `يحتاج شرح: ${v.reason}` };
  if (!v.obvious) return { code: v.rejectReason ?? 'weak_relation', message: `ممكن بس مو واضح: ${v.reason}` };
  if (v.rejectReason) return { code: v.rejectReason, message: v.reason };
  return null;
}

/** Association quality 0-1 from the judge's scores only (truthfulness is also a hard gate). */
export function quality(v: BridgeVerdict): number {
  const q =
    (0.25 * v.directness + 0.15 * v.familiarity + 0.2 * v.memorability + 0.2 * v.simplicity + 0.2 * v.truthfulness) /
      10 -
    0.02 * v.hallucinationRisk;
  return Math.round(Math.max(0, Math.min(1, q)) * 100) / 100;
}

/** Why a gate-passing association still fell below the threshold — its weakest score. */
export function lowQualityReason(v: BridgeVerdict): RejectReason {
  if (v.rejectReason) return v.rejectReason;
  const weakest = (
    [
      ['weak_relation', v.directness],
      ['obscure_reference', v.familiarity],
      ['confusing', v.simplicity],
      ['weak_relation', v.memorability]
    ] as [RejectReason, number][]
  ).sort((a, b) => a[1] - b[1])[0]!;
  return weakest[0];
}

export function confidenceLabel(q: number): 'ممتاز' | 'قوي' | 'مقبول' {
  if (q >= 0.95) return 'ممتاز';
  if (q >= 0.85) return 'قوي';
  return 'مقبول';
}

export function normalizeRef(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // Arabic diacritics/tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function namedInterests(profile: UserMemoryProfile): string[] {
  return [
    ...profile.favoriteTeams,
    ...profile.favoritePlayers,
    ...profile.favoriteShows,
    ...profile.favoriteMovies,
    ...profile.favoriteAnime,
    ...profile.favoriteGames,
    ...profile.favoriteCars,
    ...profile.favoriteMusic,
    ...profile.favoritePeople
  ];
}

function isNamedInterest(worldRef: string, profile: UserMemoryProfile): boolean {
  const target = normalizeRef(worldRef);
  if (!target) return false;
  return namedInterests(profile).some((name) => {
    const n = normalizeRef(name);
    return n.length > 0 && (target.includes(n) || n.includes(target));
  });
}

const SCREEN_WORLDS = new Set(['SERIES', 'MOVIES', 'ANIME', 'GAMES', 'CHARACTERS']);

function signal(weight: number | undefined): number {
  if (!weight) return 0;
  return weight > 0 ? 0.1 : -0.2;
}

/**
 * 0-1 personal preference, worth 20% of the final rank. Named interest and liked world add the
 * most; the student's own 👍/👎 history on this world, this association type and this
 * fact-type × association-type pair moves it up or down.
 */
export function preference(candidate: BridgeCandidate, profile: UserMemoryProfile, factType: FactType): number {
  let p = 0;
  if (isNamedInterest(candidate.worldRef, profile)) p += 0.5;
  if (profile.preferredWorlds.includes(candidate.worldCategory)) p += 0.25;
  if (SCREEN_WORLDS.has(candidate.worldCategory)) p += 0.1;
  const type = candidate.connectionType.toLowerCase();
  p += signal(profile.weights[`world:${candidate.worldCategory.toLowerCase()}`]);
  p += signal(profile.weights[`association_type:${type}`]);
  p += signal(profile.weights[`fact_assoc:${factType.toLowerCase()}:${type}`]);
  return Math.round(Math.max(0, Math.min(1, p)) * 100) / 100;
}

export function finalScore(q: number, p: number): number {
  return Math.round((QUALITY_WEIGHT * q + PREFERENCE_WEIGHT * p) * 1000) / 1000;
}
