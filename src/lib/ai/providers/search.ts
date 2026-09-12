import type { SearchProvider, SearchResultItem } from './types';

/**
 * Real live-search provider (Brave Search API by default). Required for any Connection
 * that touches recent/dynamic facts (football results, recent events) — see
 * docs/ARCHITECTURE.md §3. Configure SEARCH_API_KEY to activate.
 */
class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  readonly isLive = true;
  constructor(private apiKey: string) {}

  async search(query: string): Promise<SearchResultItem[]> {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
      { headers: { 'X-Subscription-Token': this.apiKey, Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error(`Brave Search error ${res.status}`);
    const data = await res.json();
    return (data.web?.results ?? []).map((r: { title: string; url: string; description: string; age?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      publishedAt: r.age
    }));
  }
}

/**
 * No-op provider used when SEARCH_API_KEY is not configured. `isLive: false` is the signal
 * every agent checks before allowing a LIVE_SEARCH-sourced connection — degraded mode never
 * silently falls back to LLM memory for facts that require live verification.
 */
class UnconfiguredSearchProvider implements SearchProvider {
  readonly name = 'unconfigured';
  readonly isLive = false;
  async search(): Promise<SearchResultItem[]> {
    return [];
  }
}

export function getSearchProvider(): SearchProvider {
  const key = process.env.SEARCH_API_KEY;
  if (!key) return new UnconfiguredSearchProvider();

  const provider = process.env.SEARCH_PROVIDER ?? 'brave';
  switch (provider) {
    case 'brave':
      return new BraveSearchProvider(key);
    default:
      throw new Error(`Unsupported SEARCH_PROVIDER "${provider}". Add an adapter in search.ts.`);
  }
}
