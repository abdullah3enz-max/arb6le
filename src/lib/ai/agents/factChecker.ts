import { getSearchProvider } from '@/lib/ai/providers/search';
import type { ConnectionCandidate, ConnectionSourceDraft } from '@/lib/ai/types';

export interface FactCheckResult {
  candidate: ConnectionCandidate;
  passed: boolean;
  reason: string;
}

/**
 * STEP 10: Fact-checking. For LIVE_SEARCH-sourced candidates, this re-verifies against a real
 * search call rather than trusting the Connection Finder's self-reported confidence — the
 * Finder can be wrong about what it found, this step is the independent check.
 * For KNOWLEDGE_BASE candidates in this scaffold, we enforce a minimum evidence bar
 * (non-empty evidenceSnippet + confidence) since a full curated KB isn't wired up yet —
 * see docs/ARCHITECTURE.md §10.
 */
export async function factCheckCandidate(candidate: ConnectionCandidate): Promise<FactCheckResult> {
  const search = getSearchProvider();

  for (const source of candidate.sources) {
    if (source.sourceType === 'LIVE_SEARCH') {
      if (!search.isLive) {
        return { candidate, passed: false, reason: 'LIVE_SEARCH source but no search provider configured.' };
      }
      const verified = await verifyAgainstLiveSearch(source, candidate.worldRef);
      if (!verified) {
        return { candidate, passed: false, reason: `Could not verify "${source.title ?? source.evidenceSnippet}" via live search.` };
      }
    }

    if (source.sourceType === 'KNOWLEDGE_BASE' && (source.confidence < 0.7 || !source.evidenceSnippet)) {
      return { candidate, passed: false, reason: 'Knowledge-base source below minimum confidence/evidence bar.' };
    }
  }

  if (candidate.sources.length === 0) {
    return { candidate, passed: false, reason: 'No sources attached — cannot ground this connection.' };
  }

  return { candidate, passed: true, reason: 'All sources verified.' };
}

async function verifyAgainstLiveSearch(source: ConnectionSourceDraft, worldRef: string): Promise<boolean> {
  const search = getSearchProvider();
  const query = `${worldRef} ${source.title ?? source.evidenceSnippet}`.slice(0, 200);
  const results = await search.search(query);
  const snippetWords = source.evidenceSnippet.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  return results.some((r) => {
    const haystack = `${r.title} ${r.snippet}`.toLowerCase();
    const overlap = snippetWords.filter((w) => haystack.includes(w)).length;
    return overlap >= Math.max(2, Math.floor(snippetWords.length * 0.3));
  });
}
