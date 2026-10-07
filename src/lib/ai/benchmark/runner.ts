import { findBridges } from '@/lib/ai/bridgeEngine';
import { loadInterestFacts, type InterestFactRow } from '@/lib/ai/agents/interestRetriever';
import { withModelOverride } from '@/lib/ai/router';
import { wordCount } from '@/lib/ai/bridgeScoring';
import { mapWithConcurrency } from '@/lib/ai/pipeline';
import { sectionOf, type SectionKey } from '@/lib/associations/sections';
import { BENCHMARK_FACTS, BENCHMARK_PROFILES, type BenchmarkCategory } from './dataset';
import type { BridgeConnectionType, RejectReason } from '@/lib/ai/types';

/*
 * Runs the real engine (same code path as production) over the fixed 100-fact set and turns the
 * outcome into numbers: how many associations of each kind, how many rejected and why, how many
 * hallucination flags, how long the shown lines are. Run it once per model/prompt and compare —
 * if a new model doesn't lower hallucinations and raise diversity, the problem is the pipeline.
 */

export interface BenchmarkRecord {
  category: BenchmarkCategory;
  profile: string;
  fact: string;
  selected: { type: BridgeConnectionType; world: string; link: string; quality: number; fromInterest: boolean } | null;
  rejected: { code: RejectReason; link: string }[];
  error?: string;
}

export interface BenchmarkMetrics {
  facts: number;
  withAssociation: number;
  noStrongAssociation: number;
  errors: number;
  bySection: Record<SectionKey, number>;
  byType: Partial<Record<BridgeConnectionType, number>>;
  rejectedTotal: number;
  rejectedByReason: Partial<Record<RejectReason, number>>;
  /** Candidates the judge flagged as inaccurate or likely made up (caught, not shown). */
  hallucinationsCaught: number;
  avgLinkWords: number;
  fromInterest: number;
  /** Distinct association types among shown associations (higher = more diverse). */
  distinctTypes: number;
  byCategory: Record<BenchmarkCategory, { facts: number; withAssociation: number }>;
  examples: { fact: string; profile: string; link: string; type: string; quality: number }[];
  rejectedExamples: { fact: string; link: string; code: string }[];
}

export function summarize(records: BenchmarkRecord[]): BenchmarkMetrics {
  const bySection = { numbers: 0, sound: 0, screen: 0, anime: 0, games: 0, sports: 0, concept: 0 } as Record<SectionKey, number>;
  const byType: Partial<Record<BridgeConnectionType, number>> = {};
  const rejectedByReason: Partial<Record<RejectReason, number>> = {};
  const byCategory = {} as BenchmarkMetrics['byCategory'];
  let words = 0;

  for (const r of records) {
    const cat = (byCategory[r.category] ??= { facts: 0, withAssociation: 0 });
    cat.facts++;
    for (const rej of r.rejected) rejectedByReason[rej.code] = (rejectedByReason[rej.code] ?? 0) + 1;
    if (!r.selected) continue;
    cat.withAssociation++;
    byType[r.selected.type] = (byType[r.selected.type] ?? 0) + 1;
    bySection[sectionOf(r.selected.type, r.selected.world)]++;
    words += wordCount(r.selected.link);
  }

  const shown = records.filter((r) => r.selected);
  return {
    facts: records.length,
    withAssociation: shown.length,
    noStrongAssociation: records.filter((r) => !r.selected && !r.error).length,
    errors: records.filter((r) => r.error).length,
    bySection,
    byType,
    rejectedTotal: records.reduce((n, r) => n + r.rejected.length, 0),
    rejectedByReason,
    hallucinationsCaught: (rejectedByReason.inaccurate ?? 0) + (rejectedByReason.hallucination_risk ?? 0),
    avgLinkWords: shown.length ? Math.round((words / shown.length) * 10) / 10 : 0,
    fromInterest: shown.filter((r) => r.selected!.fromInterest).length,
    distinctTypes: Object.keys(byType).length,
    byCategory,
    examples: shown.slice(0, 25).map((r) => ({
      fact: r.fact,
      profile: r.profile,
      link: r.selected!.link,
      type: r.selected!.type,
      quality: r.selected!.quality
    })),
    rejectedExamples: records
      .flatMap((r) => r.rejected.map((rej) => ({ fact: r.fact, link: rej.link, code: rej.code })))
      .slice(0, 25)
  };
}

export async function runAssociationBenchmark(opts: {
  userId: string;
  limit?: number;
  model?: string;
}): Promise<BenchmarkMetrics> {
  const facts = BENCHMARK_FACTS.slice(0, Math.max(1, Math.min(BENCHMARK_FACTS.length, opts.limit ?? 100)));

  return withModelOverride(opts.model, async () => {
    // Retrieval once per profile (cached in the shared store after the first run).
    const factsByProfile = new Map<string, InterestFactRow[]>();
    for (const p of BENCHMARK_PROFILES) factsByProfile.set(p.name, await loadInterestFacts(p.profile, opts.userId));

    const records = await mapWithConcurrency(facts, 3, async (f): Promise<BenchmarkRecord> => {
      const { name, profile } = BENCHMARK_PROFILES[BENCHMARK_FACTS.indexOf(f) % BENCHMARK_PROFILES.length]!;
      const base = { category: f.category, profile: name, fact: f.concept.atomLabel };
      try {
        const result = await findBridges(f.concept, profile, {
          userId: opts.userId,
          interestFacts: factsByProfile.get(name) ?? []
        });
        const top = result.accepted[0];
        return {
          ...base,
          selected: top
            ? {
                type: top.candidate.connectionType,
                world: top.candidate.worldCategory,
                link: top.candidate.bridgeLine,
                quality: top.quality,
                fromInterest: top.candidate.fromInterest ?? false
              }
            : null,
          rejected: result.rejected.map((r) => ({ code: r.code, link: r.candidate.bridgeLine }))
        };
      } catch (error) {
        return { ...base, selected: null, rejected: [], error: error instanceof Error ? error.message : String(error) };
      }
    });
    return summarize(records);
  });
}
