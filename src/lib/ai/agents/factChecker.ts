import { getSearchProvider } from '@/lib/ai/providers/search';
import type { BridgeCandidate } from '@/lib/ai/types';

/** Discovery-side floor only — deliberately lenient; the verifier is where strictness lives. */
const MIN_DISCOVERY_CONFIDENCE = 0.6;

export interface EvidenceCheck {
  passed: boolean;
  reason: string;
}

/**
 * Cheap, deterministic pre-filter before the (paid) verifier call: a candidate with no stated
 * evidence, or whose own author isn't confident in it, never reaches verification. When a live
 * search provider is configured, the evidence is also cross-checked against real results.
 */
export async function checkEvidence(candidate: BridgeCandidate): Promise<EvidenceCheck> {
  if (!candidate.evidence) {
    return { passed: false, reason: 'بدون دليل قابل للتحقق.' };
  }
  if (candidate.confidence < MIN_DISCOVERY_CONFIDENCE) {
    return { passed: false, reason: `ثقة منخفضة بالدليل (${candidate.confidence}).` };
  }

  const search = getSearchProvider();
  if (search.isLive && !(await verifyAgainstLiveSearch(candidate.evidence, candidate.worldRef))) {
    return { passed: false, reason: 'ما قدرنا نأكد الدليل من البحث المباشر.' };
  }

  return { passed: true, reason: 'ok' };
}

async function verifyAgainstLiveSearch(evidence: string, worldRef: string): Promise<boolean> {
  const search = getSearchProvider();
  const results = await search.search(`${worldRef} ${evidence}`.slice(0, 200));
  const words = evidence.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  return results.some((r) => {
    const haystack = `${r.title} ${r.snippet}`.toLowerCase();
    const overlap = words.filter((w) => haystack.includes(w)).length;
    return overlap >= Math.max(2, Math.floor(words.length * 0.3));
  });
}
