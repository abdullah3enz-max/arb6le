import { extractNumericAnchors } from './anchors';
import { discoverBridges } from './agents/connectionFinder';
import { verifyBridges } from './agents/connectionCritic';
import { checkEvidence } from './agents/factChecker';
import { discoverSoundScreenBridges } from './agents/soundScreenFinder';
import {
  baseScore,
  BRIDGE_SCORE_THRESHOLD,
  domainBonus,
  gateVerdict,
  normalizeRef,
  personalizationBonus
} from './bridgeScoring';
import type {
  Anchor,
  AssociationLevel,
  BridgeCandidate,
  BridgeConnectionType,
  ClaimType,
  ExtractedConcept,
  ScoredBridge,
  UserMemoryProfile
} from './types';

/*
 * CONCEPT → ANCHOR → DISCOVERY → VERIFICATION → RANKING (+≤5 personalization, +≤5 domain)
 *
 * Discovery runs two passes side by side: the general one (15-20 candidates, any domain) and a
 * sound & screen one (sound-alike terms and series/anime bridges). Both are anchored on the fact,
 * and both feed the same STRICT verification
 * (independent, temperature 0, hard gates on truth/link/forcedness/distance). If nothing survives,
 * one expansion round searches other anchors/types/domains, told why round one failed. Only then
 * does the concept honestly end with no bridge.
 */

const MAX_ROUNDS = 2;
/** Candidates sent to the verifier per round — the most diverse slice of what discovery found. */
const VERIFY_BATCH = 16;

export interface RejectedBridge {
  candidate: BridgeCandidate;
  reason: string;
  baseScore: number | null;
}

export interface BridgeSearchResult {
  memoryTarget: string;
  anchors: Anchor[];
  /** Passing bridges, best first (base score + personalization). */
  accepted: ScoredBridge[];
  rejected: RejectedBridge[];
  rounds: number;
  discovered: number;
}

export interface BridgeSearchOptions {
  userId: string;
  excludeRefs?: string[];
  excludeTypes?: BridgeConnectionType[];
}

export async function findBridges(
  concept: ExtractedConcept,
  profile: UserMemoryProfile,
  opts: BridgeSearchOptions
): Promise<BridgeSearchResult> {
  const detectedAnchors = extractNumericAnchors(`${concept.atomLabel}\n${concept.title}\n${concept.summary}`);
  const seenRefs = new Set((opts.excludeRefs ?? []).map(normalizeRef));
  const excludedTypes = new Set(opts.excludeTypes ?? []);
  const accepted: ScoredBridge[] = [];
  const rejected: RejectedBridge[] = [];
  let memoryTarget = concept.atomLabel;
  let anchors: Anchor[] = detectedAnchors;
  let priorRejections: string[] = [];
  let discovered = 0;
  let round = 0;

  while (round < MAX_ROUNDS && accepted.length === 0) {
    round++;
    const excludeRefs = [...seenRefs];
    // Either pass may fail (bad JSON, timeout) without losing the other's candidates.
    const [core, screen] = await Promise.allSettled([
      discoverBridges(concept, {
        userId: opts.userId,
        detectedAnchors,
        excludeRefs,
        excludeTypes: opts.excludeTypes ?? [],
        round,
        priorRejections
      }),
      discoverSoundScreenBridges(concept, {
        userId: opts.userId,
        memoryTarget,
        detectedAnchors,
        excludeRefs,
        round,
        priorRejections
      })
    ]);
    if (core.status === 'rejected' && screen.status === 'rejected') throw core.reason;

    if (core.status === 'fulfilled' && round === 1) {
      memoryTarget = core.value.memoryTarget;
      anchors = core.value.anchors.length ? core.value.anchors : detectedAnchors;
    }
    const coreCandidates = core.status === 'fulfilled' ? core.value.candidates : [];
    const screenCandidates = screen.status === 'fulfilled' ? screen.value : [];
    discovered += coreCandidates.length + screenCandidates.length;

    const [corePool, screenPool] = await Promise.all(
      [coreCandidates, screenCandidates].map(async (list) => {
        const pool: BridgeCandidate[] = [];
        for (const c of list) {
          if (excludedTypes.has(c.connectionType)) continue;
          const key = normalizeRef(c.worldRef);
          if (!key || seenRefs.has(key)) continue;
          seenRefs.add(key);
          const check = await checkEvidence(c);
          if (check.passed) pool.push(c);
          else rejected.push({ candidate: c, reason: check.reason, baseScore: null });
        }
        return pool;
      })
    );

    // Alternate the two passes so sound-alike and series/anime candidates always reach the verifier.
    const batch = interleave(diversify(screenPool!), diversify(corePool!)).slice(0, VERIFY_BATCH);
    const verdicts = await verifyBridges(concept, memoryTarget, batch, { userId: opts.userId });

    const roundRejections: string[] = [];
    for (const c of batch) {
      const verdict = verdicts.get(c.id);
      const gate = verdict ? gateVerdict(verdict) : 'المدقق ما أصدر حكم.';
      if (!verdict || gate) {
        rejected.push({ candidate: c, reason: gate!, baseScore: null });
        roundRejections.push(`${c.bridgeLine} — ${gate}`);
        continue;
      }
      const base = baseScore(verdict);
      if (base < BRIDGE_SCORE_THRESHOLD) {
        const reason = `درجة ${base} أقل من الحد ${BRIDGE_SCORE_THRESHOLD}: ${verdict.reason}`;
        rejected.push({ candidate: c, reason, baseScore: base });
        roundRejections.push(`${c.bridgeLine} — ${reason}`);
        continue;
      }
      const personalization = personalizationBonus(c, profile);
      const domain = domainBonus(c);
      accepted.push({
        candidate: c,
        verdict,
        baseScore: base,
        personalization,
        domainBonus: domain,
        score: base + personalization + domain
      });
    }
    priorRejections = roundRejections.slice(0, 10);
  }

  accepted.sort((a, b) => b.score - a.score);
  const result: BridgeSearchResult = { memoryTarget, anchors, accepted, rejected, rounds: round, discovered };

  if (process.env.CONNECTION_DEBUG === 'true') {
    console.log(
      '[CONNECTION_DEBUG]',
      JSON.stringify({
        concept: concept.title,
        atom: concept.atomLabel,
        memoryTarget,
        anchors,
        rounds: round,
        discovered,
        accepted: accepted.map((a) => ({
          bridge: a.candidate.bridgeLine,
          base: a.baseScore,
          bonus: a.personalization,
          domain: a.domainBonus
        })),
        rejected: rejected.map((r) => ({ bridge: r.candidate.bridgeLine, reason: r.reason }))
      })
    );
  }
  return result;
}

export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
}

/**
 * One candidate per reference, then round-robin across connection types, so the verifier's
 * limited batch always spans different kinds of bridges instead of 12 variations of one idea.
 */
export function diversify(candidates: BridgeCandidate[]): BridgeCandidate[] {
  const seen = new Set<string>();
  const byType = new Map<string, BridgeCandidate[]>();
  for (const c of candidates) {
    const key = normalizeRef(c.worldRef);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const bucket = byType.get(c.connectionType) ?? [];
    bucket.push(c);
    byType.set(c.connectionType, bucket);
  }
  const buckets = [...byType.values()];
  const ordered: BridgeCandidate[] = [];
  for (let i = 0; buckets.some((b) => i < b.length); i++) {
    for (const b of buckets) if (i < b.length) ordered.push(b[i]!);
  }
  return ordered;
}

const LEVEL_BY_TYPE: Record<BridgeConnectionType, AssociationLevel> = {
  NUMERIC: 'DIRECT_MATCH',
  MEASUREMENT: 'DIRECT_MATCH',
  PHONETIC: 'PHONETIC',
  VISUAL: 'VISUAL',
  DIRECT: 'FAMOUS_ASSOCIATION',
  POP_CULTURE: 'FAMOUS_ASSOCIATION',
  SPORTS: 'FAMOUS_ASSOCIATION',
  SEMANTIC: 'CONTEXTUAL',
  STRUCTURAL: 'CONTEXTUAL',
  NARRATIVE: 'CONTEXTUAL',
  EVERYDAY: 'CONTEXTUAL'
};

const FACTUAL_TYPES: BridgeConnectionType[] = ['NUMERIC', 'MEASUREMENT', 'DIRECT'];

/** Maps a bridge onto the existing Connection row shape (no schema change needed). */
export function connectionRowData(
  conceptId: string,
  atomLabel: string,
  candidate: BridgeCandidate,
  meta: {
    status: 'APPROVED' | 'REJECTED' | 'BELOW_THRESHOLD';
    score: number;
    memoryTarget: string;
    rejectionReason?: string;
    scored?: ScoredBridge;
    regenerationOf?: string;
  }
) {
  const claimType: ClaimType = FACTUAL_TYPES.includes(candidate.connectionType) ? 'FACT' : 'ANALOGY';
  return {
    conceptId,
    associationLevel: LEVEL_BY_TYPE[candidate.connectionType],
    worldCategory: candidate.worldCategory,
    worldRef: candidate.worldRef,
    atomEmoji: candidate.atomEmoji,
    atomLabel,
    bridgeLine: candidate.bridgeLine,
    whyOneLiner: candidate.whyOneLiner,
    claimType,
    score: meta.score,
    scoreBreakdown: {
      engine: 'anchor-first-v2',
      anchor: candidate.anchor,
      connectionType: candidate.connectionType,
      memoryTarget: meta.memoryTarget,
      evidence: candidate.evidence,
      discoveryConfidence: candidate.confidence,
      verdict: meta.scored?.verdict ?? null,
      baseScore: meta.scored?.baseScore ?? null,
      personalization: meta.scored?.personalization ?? null,
      domainBonus: meta.scored?.domainBonus ?? null,
      phonetic: candidate.phonetic ?? null
    },
    status: meta.status,
    rejectionReason: meta.rejectionReason,
    regenerationOf: meta.regenerationOf
  };
}

export function sourceRowData(candidate: BridgeCandidate) {
  return {
    sourceType: 'KNOWLEDGE_BASE' as const,
    title: candidate.worldRef,
    confidence: candidate.confidence,
    evidenceSnippet: candidate.evidence
  };
}
