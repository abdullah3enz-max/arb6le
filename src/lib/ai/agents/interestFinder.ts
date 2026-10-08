import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import {
  ASSOCIATION_RULES,
  TYPE_GUIDE,
  WORLD_CATEGORIES,
  expansionText,
  factMessage,
  normalizeCandidate
} from '@/lib/ai/agents/connectionFinder';
import type { InterestFactRow } from '@/lib/ai/agents/interestRetriever';
import type { Anchor, BridgeCandidate, BridgeConnectionType, ExtractedConcept, FactType, UserMemoryProfile } from '@/lib/ai/types';

/*
 * INTEREST discovery — the third parallel pass, and the only one that sees the student's
 * interests. Interests are an OPTIONAL POOL, not a source to force: this pass may (and usually
 * should) return nothing for a fact that has no obvious tie to them. Whatever it returns is
 * flagged fromInterest, and the judge rejects any that only "works" because the student likes it.
 * Facts about the interests come from the retrieval store; a candidate built on one cites it.
 */

const MAX_FACTS_IN_PROMPT = 60;

const SYSTEM_PROMPT =
  '[AGENT:interest_discovery] عندك معلومة دراسية واهتمامات الطالب وحقائق موثّقة عنها.\n' +
  'الاهتمامات "مخزن اختياري" مو مصدر إلزامي: لا تقحم اهتمام في معلومة. الاهتمام لازم "يستحق مكانه" ' +
  'بأنه يصنع رابط واضح وقوي فعلًا. إذا ما فيه رابط واضح مع أي اهتمام، أرجع candidates فاضية — ' +
  'وهذا المتوقع لأغلب المعلومات.\n' +
  'مثال مرفوض (نمط، مو أسماء): مصطلح طبي ← شخصية من مسلسل يحبه الطالب بدون أي علاقة حقيقية ' +
  'بينهم غير إن الطالب يحبه.\n\n' +
  'دوّر داخل الاهتمام نفسه، مو بس اسمه: شخصيات، ممثلين، أدوار، أغراض مشهورة، أماكن، أحداث، قوى، ' +
  'أرقام، عبارات، علاقات.\n' +
  '- إذا الرابط مبني على حقيقة من القائمة الموثّقة، ضع interestFactId = id الحقيقة واستخدم محتواها كما هو.\n' +
  '- إذا مبني على حقيقة مو في القائمة، لازم تكون مشهورة جدًا وأنت متأكد منها حرفيًا — وإلا لا تكتبه.\n' +
  '- 0 إلى 6 مرشحين.\n\n' +
  TYPE_GUIDE +
  '\n' +
  ASSOCIATION_RULES +
  '\nأرجع JSON فقط:\n' +
  '{"candidates":[{"anchor":"العنصر من المعلومة","connectionType":"...",' +
  `"worldCategory":"${WORLD_CATEGORIES.join('|')}",` +
  '"worldRef":"...","interestFactId":"id أو null","soundsLike":"(PHONETIC فقط)","matchedSound":"(PHONETIC فقط)",' +
  '"atomEmoji":"إيموجي واحد","bridgeLine":"عنصر → مرجع","whyOneLiner":"جملة قصيرة","evidence":"...",' +
  '"confidence":0.0,"relationDistance":1}]}';

export interface InterestOptions {
  userId: string;
  factType: FactType;
  allowedTypes: BridgeConnectionType[];
  detectedAnchors: Anchor[];
  excludeRefs: string[];
  round: number;
  priorRejections: string[];
  profile: UserMemoryProfile;
  facts: InterestFactRow[];
}

function interestSummary(profile: UserMemoryProfile): string {
  const parts: [string, string[]][] = [
    ['عوالم مفضلة', profile.preferredWorlds],
    ['فرق', profile.favoriteTeams],
    ['لاعبين', profile.favoritePlayers],
    ['مسلسلات', profile.favoriteShows],
    ['أفلام', profile.favoriteMovies],
    ['أنمي', profile.favoriteAnime],
    ['ألعاب', profile.favoriteGames],
    ['سيارات', profile.favoriteCars],
    ['موسيقى', profile.favoriteMusic],
    ['مشاهير', profile.favoritePeople]
  ];
  return parts
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}: ${v.join('، ')}`)
    .join('\n');
}

export function hasInterests(profile: UserMemoryProfile): boolean {
  return interestSummary(profile).length > 0;
}

export async function discoverInterestBridges(concept: ExtractedConcept, opts: InterestOptions): Promise<BridgeCandidate[]> {
  if (!hasInterests(opts.profile)) return [];

  // Round-robin across interests so one well-documented interest can't fill the whole list.
  const byInterest = new Map<string, InterestFactRow[]>();
  for (const f of opts.facts) byInterest.set(f.interest, [...(byInterest.get(f.interest) ?? []), f]);
  const groups = [...byInterest.values()];
  const mixed: InterestFactRow[] = [];
  for (let i = 0; mixed.length < MAX_FACTS_IN_PROMPT && groups.some((g) => i < g.length); i++) {
    for (const g of groups) if (i < g.length && mixed.length < MAX_FACTS_IN_PROMPT) mixed.push(g[i]!);
  }
  const factLines = mixed
    .map((f) => `${f.id} | ${f.interest} | ${f.kind} | ${f.subject} — ${f.attribute}: ${f.value} (${f.shortForm})`)
    .join('\n');

  const result = await routedComplete({
    tier: 'strong',
    agent: 'interest_finder',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0.6,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + expansionText(opts) },
      {
        role: 'user',
        content:
          factMessage(concept, opts) +
          `\n\nاهتمامات الطالب:\n${interestSummary(opts.profile)}` +
          `\n\nحقائق موثّقة عن الاهتمامات (id | الاهتمام | النوع | الحقيقة):\n${factLines || 'لا يوجد بعد'}`
      }
    ]
  });
  if (result.isMock) return [];

  const knownFacts = new Map(opts.facts.map((f) => [f.id, f]));
  const parsed = parseJsonResponse<{ candidates?: Record<string, unknown>[] }>(result.text);
  const out: BridgeCandidate[] = [];
  (parsed.candidates ?? []).forEach((raw, i) => {
    const c = normalizeCandidate(raw, `r${opts.round}i${i + 1}`, concept.atomEmoji);
    if (!c) return;
    const fact = typeof raw?.interestFactId === 'string' ? knownFacts.get(raw.interestFactId) : undefined;
    out.push({
      ...c,
      fromInterest: true,
      ...(fact ? { interestFactId: fact.id, evidence: `${fact.subject} — ${fact.attribute}: ${fact.value}` } : {})
    });
  });
  return out;
}

/**
 * No model involved: when the fact contains a number and a retrieved, verified interest fact has
 * that exact number, the association is built directly from the stored fact ("7 → Ronaldo #7").
 * It still goes to the judge, which decides whether it is obvious enough to show.
 */
export function numericInterestMatches(
  factNumbers: string[],
  facts: InterestFactRow[],
  round: number,
  atomEmoji: string
): BridgeCandidate[] {
  const wanted = new Set(factNumbers);
  return facts
    .filter((f) => f.kind === 'NUMBER' && wanted.has(f.value.replace(/[^\d.]/g, '')))
    .slice(0, 3)
    .map((f, i) => {
      const n = f.value.replace(/[^\d.]/g, '');
      return {
        id: `r${round}n${i + 1}`,
        anchor: n,
        connectionType: 'NUMERIC' as const,
        worldCategory: f.worldCategory,
        worldRef: f.subject,
        atomEmoji,
        bridgeLine: `${n} → ${f.shortForm}`,
        whyOneLiner: `${f.attribute}: ${f.value}`,
        evidence: `${f.subject} — ${f.attribute}: ${f.value}`,
        confidence: f.confidence,
        relationDistance: 1,
        fromInterest: true,
        interestFactId: f.id
      };
    });
}
