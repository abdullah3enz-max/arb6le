import { extractNumericAnchors } from './anchors';
import { discoverBridges } from './agents/connectionFinder';
import { verifyBridges } from './agents/connectionCritic';
import { checkClaims } from './agents/claimChecker';
import { checkEvidence } from './agents/factChecker';
import { discoverInterestBridges, hasInterests, numericInterestMatches } from './agents/interestFinder';
import type { InterestFactRow } from './agents/interestRetriever';
import { discoverPhoneticBridges } from './agents/phoneticFinder';
import {
  confidenceLabel,
  finalScore,
  gateVerdict,
  lowQualityReason,
  normalizeRef,
  numbersIn,
  preGate,
  preference,
  QUALITY_THRESHOLD,
  quality
} from './bridgeScoring';
import { allowedTypes, classifyFact, hasNumericAnchor, typeRank } from './factTypes';
import type {
  Anchor,
  AssociationLevel,
  BridgeCandidate,
  BridgeConnectionType,
  ClaimType,
  ExtractedConcept,
  FactType,
  RejectReason,
  ScoredBridge,
  UserMemoryProfile
} from './types';

/*
 * CORE ASSOCIATION ENGINE
 *
 *   FACT → CLASSIFY (fact type → allowed association types)
 *        → STAGE 1: three discovery passes in parallel
 *             general (every allowed type) · phonetic & word · interest (optional pool + verified
 *             interest facts), plus exact number matches against retrieved interest facts
 *        → deterministic pre-gates (one-glance length, real number, sound pair, evidence)
 *        → STAGE 2: one independent judge for the whole batch
 *        → hard gates → quality ≥ threshold (judge only)
 *        → rank: 0.8 × quality + 0.2 × preference
 *        → sceptical fact check of the top few (only an explicit TRUE is ever shown)
 *
 * If nothing survives, one expansion round tries again, told why round one failed. Then the
 * fact honestly ends with NO STRONG ASSOCIATION — it still becomes a flashcard.
 */

const MAX_ROUNDS = 2;
/** Candidates judged per round — a balanced slice across the discovery passes. */
const VERIFY_BATCH = 18;
/** Numbers must not crowd out the other association types in the judge's batch. */
const MAX_NUMERIC_IN_BATCH = 4;

export interface RejectedBridge {
  candidate: BridgeCandidate;
  code: RejectReason;
  reason: string;
  quality: number | null;
}

export interface BridgeSearchResult {
  factType: FactType;
  memoryTarget: string;
  anchors: Anchor[];
  /** Passing associations, best first. The first is shown; the rest are "🔄 رابط آخر". */
  accepted: ScoredBridge[];
  rejected: RejectedBridge[];
  rounds: number;
  discovered: number;
}

export interface BridgeSearchOptions {
  userId: string;
  excludeRefs?: string[];
  excludeTypes?: BridgeConnectionType[];
  /** Retrieved, verified facts about the student's interests (see interestRetriever.ts). */
  interestFacts?: InterestFactRow[];
}

export async function findBridges(
  concept: ExtractedConcept,
  profile: UserMemoryProfile,
  opts: BridgeSearchOptions
): Promise<BridgeSearchResult> {
  const factText = `${concept.atomLabel}\n${concept.title}\n${concept.summary}`;
  const detectedAnchors = extractNumericAnchors(factText);
  const hasNumber = hasNumericAnchor(detectedAnchors);
  const interestFacts = opts.interestFacts ?? [];
  const excludedTypes = new Set(opts.excludeTypes ?? []);
  const seenRefs = new Set((opts.excludeRefs ?? []).map(normalizeRef));

  let factType = classifyFact(concept, detectedAnchors);
  let memoryTarget = concept.atomLabel;
  let anchors: Anchor[] = detectedAnchors;
  const accepted: ScoredBridge[] = [];
  const rejected: RejectedBridge[] = [];
  let priorRejections: string[] = [];
  let discovered = 0;
  let round = 0;

  while (round < MAX_ROUNDS && accepted.length === 0) {
    round++;
    const allowed = allowedTypes(factType, hasNumber).filter((t) => !excludedTypes.has(t));
    const shared = {
      userId: opts.userId,
      factType,
      allowedTypes: allowed,
      detectedAnchors,
      excludeRefs: [...seenRefs],
      round,
      priorRejections
    };
    const wantsSound = allowed.includes('PHONETIC') || allowed.includes('WORD');
    // Runs whenever there is material: the student's interests or the series/anime pool.
    const wantsInterest = hasInterests(profile) || interestFacts.length > 0;

    // Any pass may fail (bad JSON, timeout) without losing the others' candidates.
    const [general, sound, interest] = await Promise.allSettled([
      discoverBridges(concept, shared),
      wantsSound ? discoverPhoneticBridges(concept, shared) : Promise.resolve([]),
      wantsInterest ? discoverInterestBridges(concept, { ...shared, profile, facts: interestFacts }) : Promise.resolve([])
    ]);
    const attempted = [general, ...(wantsSound ? [sound] : []), ...(wantsInterest ? [interest] : [])];
    if (attempted.every((p) => p.status === 'rejected')) throw (general as PromiseRejectedResult).reason;

    if (general.status === 'fulfilled' && round === 1) {
      memoryTarget = general.value.memoryTarget;
      anchors = general.value.anchors.length ? general.value.anchors : detectedAnchors;
      // The model may refine the fact type, but never into a number type without a real number.
      const refined = general.value.factType;
      if ((refined !== 'NUMBER' && refined !== 'TIME') || hasNumber) factType = refined;
    }
    const allowedNow = new Set(allowedTypes(factType, hasNumber).filter((t) => !excludedTypes.has(t)));

    const sources: BridgeCandidate[][] = [
      hasNumber ? numericInterestMatches(numbersIn(`${concept.atomLabel} ${concept.title}`), interestFacts, round, concept.atomEmoji) : [],
      interest.status === 'fulfilled' ? interest.value : [],
      sound.status === 'fulfilled' ? sound.value : [],
      general.status === 'fulfilled' ? general.value.candidates : []
    ];
    discovered += sources.reduce((n, s) => n + s.length, 0);

    const pools: BridgeCandidate[][] = [];
    for (const list of sources) {
      const pool: BridgeCandidate[] = [];
      for (const c of list) {
        const reject = (code: RejectReason, reason: string) => rejected.push({ candidate: c, code, reason, quality: null });
        if (!allowedNow.has(c.connectionType)) {
          reject('weak_relation', `نوع ربط ${c.connectionType} ما يناسب معلومة من نوع ${factType}`);
          continue;
        }
        const key = normalizeRef(c.worldRef);
        if (!key || seenRefs.has(key)) {
          reject('duplicate', 'مرجع مكرر أو مستخدم كثير في هالملف');
          continue;
        }
        seenRefs.add(key);
        const pre = preGate(c, factText, factType);
        if (pre) {
          reject(pre.code, pre.message);
          continue;
        }
        if (!c.interestFactId) {
          const check = await checkEvidence(c);
          if (!check.passed) {
            reject('hallucination_risk', check.reason);
            continue;
          }
        }
        pool.push(c);
      }
      pools.push(pool);
    }

    const batch = balancedBatch(pools.map(diversify));
    const verdicts = await verifyBridges(concept, memoryTarget, batch, { userId: opts.userId, factType });

    const roundRejections: string[] = [];
    const passed: ScoredBridge[] = [];
    for (const c of batch) {
      const verdict = verdicts.get(c.id);
      if (!verdict) {
        rejected.push({ candidate: c, code: 'weak_relation', reason: 'الحكم ما أصدر حكم', quality: null });
        continue;
      }
      const gate = gateVerdict(c, verdict);
      if (gate) {
        rejected.push({ candidate: c, code: gate.code, reason: gate.message, quality: null });
        roundRejections.push(`${c.bridgeLine} — ${gate.code}: ${gate.message}`);
        continue;
      }
      const q = quality(verdict);
      if (q < QUALITY_THRESHOLD) {
        const code = lowQualityReason(verdict);
        const reason = `ثقة ${q} أقل من ${QUALITY_THRESHOLD}: ${verdict.reason}`;
        rejected.push({ candidate: c, code, reason, quality: q });
        roundRejections.push(`${c.bridgeLine} — ${code}: ${reason}`);
        continue;
      }
      const p = preference(c, profile, factType);
      passed.push({ candidate: c, verdict, quality: q, preference: p, final: finalScore(q, p) });
    }

    // Last line before display: only associations a separate, sceptical fact check confirms.
    passed.sort(byRank(factType));
    const confirmed = await confirmClaims(concept, passed, opts.userId, (r) => {
      rejected.push(r);
      roundRejections.push(`${r.candidate.bridgeLine} — ${r.code}: ${r.reason}`);
    });
    accepted.push(...confirmed);
    priorRejections = roundRejections.slice(0, 10);
  }

  accepted.sort(byRank(factType));
  const result: BridgeSearchResult = { factType, memoryTarget, anchors, accepted, rejected, rounds: round, discovered };

  if (process.env.CONNECTION_DEBUG === 'true') {
    console.log(
      '[CONNECTION_DEBUG]',
      JSON.stringify({
        concept: concept.title,
        atom: concept.atomLabel,
        factType,
        memoryTarget,
        anchors,
        rounds: round,
        discovered,
        accepted: accepted.map((a) => ({
          type: a.candidate.connectionType,
          link: a.candidate.bridgeLine,
          quality: a.quality,
          preference: a.preference,
          final: a.final,
          fromInterest: a.candidate.fromInterest ?? false
        })),
        rejected: rejected.map((r) => ({ type: r.candidate.connectionType, link: r.candidate.bridgeLine, code: r.code, reason: r.reason }))
      })
    );
  }
  return result;
}

function byRank(factType: FactType) {
  return (a: ScoredBridge, b: ScoredBridge) =>
    b.final - a.final || typeRank(factType, a.candidate.connectionType) - typeRank(factType, b.candidate.connectionType);
}

/** Shown association + alternatives that need a confirmed claim; and a cap on checks per round. */
const CONFIRMED_NEEDED = 3;
const MAX_CLAIM_CHECKS = 6;

/** Built in code from a stored, verified interest fact ("7 → Striker #7") — nothing left to check. */
function isDeterministic(c: BridgeCandidate): boolean {
  return /^r\d+n\d+$/.test(c.id) && c.interestFactId !== undefined;
}

/**
 * Fact-checks the best passing associations, best first, until three are confirmed or six have
 * been checked. Anything not explicitly TRUE is rejected (FALSE → inaccurate, UNSURE →
 * hallucination_risk) and never shown.
 */
async function confirmClaims(
  concept: ExtractedConcept,
  ranked: ScoredBridge[],
  userId: string,
  reject: (r: RejectedBridge) => void
): Promise<ScoredBridge[]> {
  const confirmed: ScoredBridge[] = [];
  const pending = [...ranked];
  let checked = 0;
  while (pending.length && confirmed.length < CONFIRMED_NEEDED && checked < MAX_CLAIM_CHECKS) {
    const chunk = pending.splice(0, Math.min(CONFIRMED_NEEDED - confirmed.length, MAX_CLAIM_CHECKS - checked));
    const toCheck = chunk.filter((a) => !isDeterministic(a.candidate));
    const verdicts = await checkClaims(
      toCheck.map((a) => ({
        id: a.candidate.id,
        statement: `المعلومة: ${concept.atomLabel} | الرابط: ${a.candidate.bridgeLine} | الدليل: ${a.candidate.evidence}`
      })),
      { userId }
    );
    checked += toCheck.length;
    for (const a of chunk) {
      if (isDeterministic(a.candidate)) {
        confirmed.push(a);
        continue;
      }
      const v = verdicts.get(a.candidate.id);
      if (v?.verdict === 'TRUE') confirmed.push(a);
      else
        reject({
          candidate: a.candidate,
          code: v?.verdict === 'FALSE' ? 'inaccurate' : 'hallucination_risk',
          reason: `التدقيق النهائي: ${v?.verdict ?? 'بدون حكم'}${v?.note ? ` — ${v.note}` : ''} (جودة ${a.quality})`,
          quality: null
        });
    }
  }
  return confirmed;
}

/**
 * Within one pass: one candidate per reference, then round-robin across association types, so a
 * pass that listed five number ideas first doesn't fill its share of the batch with numbers.
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

/**
 * Round-robin across the discovery passes (verified interest numbers, interest, phonetic,
 * general), one reference each, with numbers capped — so the judge always compares several
 * association types instead of a batch of number matches.
 */
export function balancedBatch(pools: BridgeCandidate[][]): BridgeCandidate[] {
  const batch: BridgeCandidate[] = [];
  let numeric = 0;
  const queues = pools.map((p) => [...p]);
  while (batch.length < VERIFY_BATCH && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length) {
        const c = q.shift()!;
        if (c.connectionType === 'NUMERIC') {
          if (numeric >= MAX_NUMERIC_IN_BATCH) continue;
          numeric++;
        }
        batch.push(c);
        break;
      }
      if (batch.length >= VERIFY_BATCH) break;
    }
  }
  return batch;
}

const LEVEL_BY_TYPE: Record<BridgeConnectionType, AssociationLevel> = {
  NUMERIC: 'DIRECT_MATCH',
  PHONETIC: 'PHONETIC',
  VISUAL: 'VISUAL',
  CHARACTER: 'FAMOUS_ASSOCIATION',
  SCENE: 'CONTEXTUAL',
  WORD: 'CONTEXTUAL',
  CONCEPTUAL: 'CONTEXTUAL',
  MINI_STORY: 'CONTEXTUAL'
};

const FACTUAL_TYPES: BridgeConnectionType[] = ['NUMERIC', 'CHARACTER', 'SCENE'];

/** Maps an association onto the existing Connection row shape. */
export function connectionRowData(
  conceptId: string,
  atomLabel: string,
  candidate: BridgeCandidate,
  meta: {
    status: 'APPROVED' | 'ALTERNATIVE' | 'REJECTED' | 'BELOW_THRESHOLD';
    factType: FactType;
    memoryTarget: string;
    scored?: ScoredBridge;
    rejected?: RejectedBridge;
    regenerationOf?: string;
  }
) {
  const claimType: ClaimType = FACTUAL_TYPES.includes(candidate.connectionType) ? 'FACT' : 'ANALOGY';
  const final = meta.scored?.final ?? meta.rejected?.quality ?? 0;
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
    score: Math.round(final * 100),
    scoreBreakdown: {
      engine: 'association-v3',
      factType: meta.factType,
      connectionType: candidate.connectionType,
      anchor: candidate.anchor,
      memoryTarget: meta.memoryTarget,
      evidence: candidate.evidence,
      discoveryConfidence: candidate.confidence,
      fromInterest: candidate.fromInterest ?? false,
      interestFactId: candidate.interestFactId ?? null,
      phonetic: candidate.phonetic ?? null,
      quality: meta.scored?.quality ?? meta.rejected?.quality ?? null,
      preference: meta.scored?.preference ?? null,
      final: meta.scored?.final ?? null,
      confidence: meta.scored ? confidenceLabel(meta.scored.quality) : null,
      verdict: meta.scored?.verdict ?? null,
      rejectCode: meta.rejected?.code ?? null
    },
    status: meta.status,
    rejectionReason: meta.rejected ? `${meta.rejected.code}: ${meta.rejected.reason}` : undefined,
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
