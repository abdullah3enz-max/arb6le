import type { BridgeCandidate, BridgeVerdict, UserMemoryProfile } from './types';

/** Minimum BASE score (before any personalization) for a bridge to be shown at all. */
export const BRIDGE_SCORE_THRESHOLD = Number(process.env.BRIDGE_SCORE_THRESHOLD ?? 70);

/** Personalization is a tie-breaker only: it can reorder passing bridges, never rescue one. */
export const MAX_PERSONALIZATION_BONUS = 5;

const DISTANCE_SCORE: Record<number, number> = { 1: 100, 2: 70, 3: 40 };

/** Hard gates: any failure rejects the bridge regardless of how well it scores otherwise. */
export function gateVerdict(v: BridgeVerdict): string | null {
  if (!v.factTrue) return `الحقيقة غير صحيحة أو غير مؤكدة: ${v.reason}`;
  if (!v.linkTrue) return `ليس تطابقًا حقيقيًا مع المعلومة: ${v.reason}`;
  if (v.forcedness === 'FORCED') return `ربط مُجبَر: ${v.reason}`;
  if (v.relationDistance > 3) return `الرابط بعيد (${v.relationDistance} خطوات): ${v.reason}`;
  return null;
}

/**
 * Quality score from the independent verifier's judgment only — the discovery step's opinion of
 * its own candidates never counts. Truthfulness is not weighted here because it is a hard gate.
 */
export function baseScore(v: BridgeVerdict): number {
  const distance = DISTANCE_SCORE[v.relationDistance] ?? 0;
  let score =
    0.3 * v.scores.connection +
    0.25 * v.scores.memorability +
    0.2 * v.scores.simplicity +
    0.15 * v.scores.evidence +
    0.1 * distance;
  if (v.forcedness === 'WEAK') score -= 10;
  if (!v.coversMemoryTarget) score -= 15;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function normalizeRef(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // Arabic diacritics/tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isNamedInterest(worldRef: string, profile: UserMemoryProfile): boolean {
  const target = normalizeRef(worldRef);
  if (!target) return false;
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
  ].some((name) => {
    const n = normalizeRef(name);
    return n.length > 0 && (target.includes(n) || n.includes(target));
  });
}

/**
 * 0-5 points, applied only to bridges that already passed on their own merit. Liked domain and
 * named interest add a little; a domain the student keeps rejecting (feedback weights) can take
 * it back to 0 — never below, so dislikes never sink an otherwise-strong bridge either.
 */
export function personalizationBonus(candidate: BridgeCandidate, profile: UserMemoryProfile): number {
  let bonus = 0;
  if (profile.preferredWorlds.includes(candidate.worldCategory)) bonus += 3;
  if (isNamedInterest(candidate.worldRef, profile)) bonus += 2;
  const feedback = profile.weights[`world:${candidate.worldCategory.toLowerCase()}`] ?? 0;
  if (feedback > 0) bonus += 1;
  if (feedback < 0) bonus -= 3;
  return Math.max(0, Math.min(MAX_PERSONALIZATION_BONUS, bonus));
}
