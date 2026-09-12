import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { getSearchProvider } from '@/lib/ai/providers/search';
import type { ConnectionCandidate, ExtractedConcept, UserMemoryProfile } from '@/lib/ai/types';

/**
 * STEP 9: search for real connections inside the user's worlds.
 * Two lanes:
 *  - KNOWLEDGE_BASE lane: stable, non-time-sensitive works (classic film/show plots) — LLM may
 *    draft candidates from training knowledge, but every one still goes through Fact Checker.
 *  - LIVE_SEARCH lane: sports/recent events — candidates are only proposed for worlds where a
 *    live SearchProvider result actually backs the claim. If the search provider is
 *    unconfigured, this lane is skipped entirely rather than guessed by the LLM.
 */
export async function findConnectionCandidates(
  concept: ExtractedConcept,
  profile: UserMemoryProfile,
  opts: { userId: string; cacheKeyPrefix: string; excludeWorldRefs?: string[] }
): Promise<ConnectionCandidate[]> {
  const worldsDescription = describeWorlds(profile);
  if (!worldsDescription) return [];

  const search = getSearchProvider();
  const liveSearchNote = search.isLive
    ? 'LIVE_SEARCH متاح — إذا اقترحت رابطًا من كرة القدم/أحداث حديثة، ضع claimType واضح وسنتحقق منه بالبحث الفعلي.'
    : 'LIVE_SEARCH غير متاح الآن (لا يوجد SEARCH_API_KEY) — لا تقترح أي رابط يعتمد على نتائج مباريات أو أحداث حديثة أو إحصائيات؛ اقترح فقط من أعمال/شخصيات ثابتة تاريخيًا إذا كانت العلاقة حقيقية فعلًا، وإلا أرجع مصفوفة فاضية.';

  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_finder',
    userId: opts.userId,
    responseFormat: 'json',
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:connection_finder] مهمتك إيجاد علاقة حقيقية ومنطقية بين مفهوم أكاديمي وعالم ' +
          'يحبه المستخدم — نفس السلوك أو التسلسل أو الآلية أو النتيجة، وليس تشابه أسماء أو تشبيه ' +
          'سطحي ("القلب مثل حارس المرمى" ممنوع). إذا لم توجد علاقة قوية حقيقية، أرجع ' +
          'مصفوفة candidates فاضية — هذا أفضل من رابط ضعيف. ' +
          liveSearchNote +
          (opts.excludeWorldRefs?.length
            ? ` لا تكرر هذه الزوايا المستخدمة سابقًا: ${opts.excludeWorldRefs.join(', ')}.`
            : '') +
          ' أرجع JSON: {"candidates": [{"type":"CHARACTER|EVENT|CAUSE_EFFECT|SEQUENCE|CONTRAST|STORY|VISUAL|COMPARISON",' +
          '"worldCategory","worldRef","headline","relationExplain","memoryHook",' +
          '"claimType":"FACT|ANALOGY|INTERPRETATION",' +
          '"sources":[{"sourceType":"KNOWLEDGE_BASE|LIVE_SEARCH","confidence"(0-1),"evidenceSnippet","title","url"}],' +
          '"scoreBreakdown":{"semanticRelevance","factualAccuracy","relationshipStrength","memorability",' +
          '"preferenceMatch","contextMatch","specificity"} (كل قيمة 0-100)}]}'
      },
      {
        role: 'user',
        content: `المفهوم: ${concept.title}\nالشرح: ${concept.summary}\nنوعه: ${concept.conceptType}\n\nعوالم المستخدم:\n${worldsDescription}`
      }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ candidates: ConnectionCandidate[] }>(result.text);
  const candidates = parsed.candidates ?? [];

  // Enforce the LIVE_SEARCH gate in code, not just in the prompt: strip/downgrade any
  // candidate that cites LIVE_SEARCH while the provider is unconfigured.
  return candidates
    .filter((c) => search.isLive || !c.sources.some((s) => s.sourceType === 'LIVE_SEARCH'))
    .map((c) => enrichWithMemoryProfile(c, profile));
}

function describeWorlds(profile: UserMemoryProfile): string {
  const parts: string[] = [];
  if (profile.favoriteShows.length) parts.push(`مسلسلات: ${profile.favoriteShows.join(', ')}`);
  if (profile.favoriteMovies.length) parts.push(`أفلام: ${profile.favoriteMovies.join(', ')}`);
  if (profile.favoriteTeams.length) parts.push(`فرق كرة قدم: ${profile.favoriteTeams.join(', ')}`);
  if (profile.favoritePlayers.length) parts.push(`لاعبين: ${profile.favoritePlayers.join(', ')}`);
  if (profile.preferredWorlds.length) parts.push(`عوالم مفضلة: ${profile.preferredWorlds.join(', ')}`);
  return parts.join('\n');
}

function enrichWithMemoryProfile(candidate: ConnectionCandidate, profile: UserMemoryProfile): ConnectionCandidate {
  const weightKey = `world:${candidate.worldCategory.toLowerCase()}`;
  const bonus = profile.weights[weightKey] ?? 0;
  return {
    ...candidate,
    scoreBreakdown: {
      ...candidate.scoreBreakdown,
      preferenceMatch: Math.max(0, Math.min(100, candidate.scoreBreakdown.preferenceMatch + bonus))
    }
  };
}
