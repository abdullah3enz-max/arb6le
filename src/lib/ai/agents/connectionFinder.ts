import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { getSearchProvider } from '@/lib/ai/providers/search';
import type {
  AssociationLevel,
  ClaimType,
  ConnectionCandidate,
  ExtractedConcept,
  UserMemoryProfile,
  WorldCategory
} from '@/lib/ai/types';

// Deliberately NO concrete names (players, shows, discoverers) anywhere in this prompt: every
// named example that used to live here was copied back verbatim as an "answer" for unrelated
// facts, which is how every concept collapsed onto the same footballer.
const CORE_RULES =
  'القواعد الثابتة:\n' +
  '- المعلومة الأصلية ما تتغير أبدًا (الرقم/المصطلح كما هو 100%). الرابط وسيلة حفظ فقط، مو شرح.\n' +
  '- كل مرشح = رابط واحد واضح يُفهم خلال ثانيتين. bridgeLine سطر واحد قصير جدًا بصيغة "X = Y" ' +
  'أو "X ← Y"، بدون قصة ولا "تخيل".\n' +
  '- whyOneLiner جملة أو جملتين تسمّي الآلية الحقيقية بالضبط: وش الصوت المتشابه، أو وش الحقيقة ' +
  'المشهورة، أو وش القصة/المشهد اللي يمشي بنفس النمط.\n' +
  '- ممنوع تخترع حقيقة. إذا ما أنت متأكد من حقيقة عن مرجع، لا تستخدمه.';

const METHOD =
  'طريقة العمل (نفّذها داخليًا بالترتيب، وأرجع النتيجة فقط):\n' +
  '1) حلّل المعلومة واستخرج خطافات الحفظ منها:\n' +
  '   أ. الكلمة المفتاحية: المصطلح نفسه، ترجمته العربية، مقاطعه، أصله اللغوي، أو اسم مكتشفه الحقيقي.\n' +
  '   ب. النطق: كيف ينطقها طالب سعودي بصوت عالي؟ وش كلمة عربية أو كلمة باللهجة السعودية، أو اسم ' +
  'مسلسل/شخصية/أغنية/لعبة/لاعب/ماركة، ينطق قريب منها فعلًا؟ (تشابه صوتي واضح لمقطع كامل، مو حرف ' +
  'واحد مشترك).\n' +
  '   ج. الأرقام: أي رقم بالمعلومة وش يطابقه من أرقام مشهورة فعلًا (رقم لاعب، عدد مواسم/أجزاء/شخصيات، ' +
  'سنة حدث، رقم معروف بالحياة اليومية).\n' +
  '   د. الشكل: هل للمعلومة شكل أو لون أو رمز يشبه شي معروف؟\n' +
  '   هـ. القصة/النمط: هل المعلومة خطوات، سبب ونتيجة، ضدين، تسلسل، أو دور/وظيفة؟ وش مشهد أو حبكة أو ' +
  'شخصية من مسلسل/فيلم/أنمي/لعبة/مباراة مشهورة تمشي بنفس النمط بالضبط؟\n' +
  '2) لكل خطاف قوي دوّر بكل هذي العوالم: مسلسلات (خليجية، عربية، عالمية)، أفلام، أنمي، ألعاب فيديو، ' +
  'كرة القدم (لاعبين، فرق، بطولات، لحظات مشهورة)، أغاني وفنانين، مشاهير، سيارات وماركات، الحياة ' +
  'اليومية بالسعودية والخليج، كلمات عربية ولهجة، أمثال شعبية، تاريخ وجغرافيا، أرقام مشهورة.\n' +
  '3) عوالم الطالب المفضلة (بالأسفل) أولوية مو حدود: فضّل المراجع المشهورة جدًا داخل هالعوالم حتى ' +
  'لو الطالب ما سمّاها بالاسم (يحب المسلسلات = أي مسلسل مشهور جدًا مقبول). الأسماء اللي سمّاها ' +
  'الطالب بنفسه ميزة إضافية فقط إذا فيه حقيقة حقيقية ومحددة تربطها بالمعلومة — مو إجبار.';

const DIVERSITY_RULES =
  'قواعد التنوع (إلزامية):\n' +
  '- ولّد 6 إلى 10 مرشحين، كل مرشح بمرجع (worldRef) مختلف.\n' +
  '- لازم يغطون 3 فئات worldCategory مختلفة على الأقل، ونوعين خطاف مختلفين على الأقل (مثلًا نطق + قصة).\n' +
  '- أي شخص أو اسم محدد يظهر بمرشح واحد فقط كحد أقصى.\n' +
  '- ممنوع تلزّق اسم مشهور على معلومة بصفة عامة ("فلان = الدقة"، "فلان = العمق"، "فلان = القوة") — ' +
  'هذا ربط فاضي ومرفوض. الرابط لازم يقوم على خطاف محدد من الخطوة 1.\n' +
  '- أي اسم يظهر بتعليمات سابقة أو بأمثلة هو لشرح الطريقة فقط، مو قالب تعيد استخدامه.\n' +
  '- أرجع مصفوفة فاضية فقط إذا ما فيه ولا خطاف واحد يوصل لرابط صادق بأي عالم.';

const WORLD_CATEGORIES: WorldCategory[] = [
  'SERIES',
  'MOVIES',
  'FOOTBALL',
  'GAMES',
  'ANIME',
  'CARS',
  'MUSIC',
  'PEOPLE',
  'CHARACTERS',
  'BOOKS',
  'DAILY_LIFE',
  'GENERAL_KNOWLEDGE'
];
const ASSOCIATION_LEVELS: AssociationLevel[] = ['DIRECT_MATCH', 'PHONETIC', 'VISUAL', 'FAMOUS_ASSOCIATION', 'CONTEXTUAL'];
const CLAIM_TYPES: ClaimType[] = ['FACT', 'ANALOGY', 'INTERPRETATION'];

const OUTPUT_SCHEMA =
  'أرجع JSON فقط: {"candidates": [{' +
  `"worldCategory": "${WORLD_CATEGORIES.join('|')}" (DAILY_LIFE للكلمات العربية واللهجة والحياة اليومية),` +
  '"associationLevel": "PHONETIC للنطق | DIRECT_MATCH لرقم مطابق | VISUAL للشكل | ' +
  'FAMOUS_ASSOCIATION لحقيقة مشهورة | CONTEXTUAL للقصة/النمط",' +
  '"worldRef","atomEmoji","atomLabel","bridgeLine","whyOneLiner",' +
  '"claimType":"FACT|ANALOGY|INTERPRETATION",' +
  '"sources":[{"sourceType":"KNOWLEDGE_BASE|LIVE_SEARCH","confidence"(0-1),"evidenceSnippet","title","url"}],' +
  '"scoreBreakdown":{"directness","familiarity","simplicity","memorability","relevance","confusionRisk"} ' +
  '(كل قيمة 0-100، confusionRisk أعلى = أسوأ)}]}';

const WORLD_LABEL_AR: Record<string, string> = {
  SERIES: 'مسلسلات',
  MOVIES: 'أفلام',
  FOOTBALL: 'كرة قدم',
  GAMES: 'ألعاب فيديو',
  ANIME: 'أنمي',
  CARS: 'سيارات',
  MUSIC: 'موسيقى وأغاني',
  PEOPLE: 'مشاهير',
  CHARACTERS: 'شخصيات',
  BOOKS: 'كتب',
  DAILY_LIFE: 'حياة يومية'
};

/**
 * STEP 9: find real memory bridges. Decomposes the fact into hooks (keyword, pronunciation,
 * numbers, shape, story pattern) and searches every domain for each hook — the student's liked
 * domains are a priority, never a boundary, and specific saved names are a bonus, never a
 * template. Every candidate still goes through the Fact Checker and the Critic.
 */
export async function findConnectionCandidates(
  concept: ExtractedConcept,
  profile: UserMemoryProfile,
  opts: { userId: string; cacheKeyPrefix: string; excludeWorldRefs?: string[] }
): Promise<ConnectionCandidate[]> {
  const search = getSearchProvider();
  const liveSearchNote = search.isLive
    ? 'LIVE_SEARCH متاح — لو اقترحت رابط يعتمد على معلومة حديثة، حدد claimType وسنتحقق منه فعليًا.'
    : 'LIVE_SEARCH غير متاح — لا تقترح أي رابط يعتمد على نتيجة مباراة أو إحصائية حديثة؛ استخدم حقائق ثابتة معروفة فقط.';

  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_finder',
    userId: opts.userId,
    responseFormat: 'json',
    // Room for 6-10 candidates plus hidden reasoning tokens on reasoning-style models.
    maxTokens: 6144,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:connection_finder] أنت محرك ربط ذاكرة (Memory Association Engine)، مو مدرّس يشرح. ' +
          'هدفك: أقصر جسر ذهني صادق بين معلومة دراسية صعبة وشيء يعرفه الطالب، بحيث تعلق المعلومة ' +
          'بذاكرته من أول نظرة.\n\n' +
          CORE_RULES +
          '\n\n' +
          METHOD +
          '\n\n' +
          DIVERSITY_RULES +
          '\n\n' +
          liveSearchNote +
          (opts.excludeWorldRefs?.length
            ? `\nمراجع استُخدمت كثير بهذا الملف — تجنّبها واختر غيرها: ${opts.excludeWorldRefs.join(', ')}.`
            : '') +
          '\n\n' +
          OUTPUT_SCHEMA
      },
      {
        role: 'user',
        content:
          `المعلومة (لا تغيّرها): ${concept.atomLabel}\nالسياق: ${concept.title} — ${concept.summary}\n` +
          `نوعها: ${concept.conceptType}\n\n${describeWorlds(profile)}` +
          describeStylePreference(profile.connectionStyles)
      }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ candidates: ConnectionCandidate[] }>(result.text);
  const candidates = (parsed.candidates ?? [])
    .filter((c) => c && typeof c.worldRef === 'string' && typeof c.bridgeLine === 'string')
    // LIVE_SEARCH gate enforced in code, not just in the prompt.
    .filter((c) => search.isLive || !(c.sources ?? []).some((s) => s.sourceType === 'LIVE_SEARCH'))
    .map(normalizeCandidate)
    .map((c) => enrichWithMemoryProfile(c, profile));

  return diversify(candidates);
}

/**
 * A model returning an enum value outside the DB enum (e.g. worldCategory "TV") would make the
 * Prisma insert throw and silently lose an otherwise-good candidate — coerce instead.
 */
function normalizeCandidate(c: ConnectionCandidate): ConnectionCandidate {
  const category = String(c.worldCategory ?? '').toUpperCase() as WorldCategory;
  const level = String(c.associationLevel ?? '').toUpperCase() as AssociationLevel;
  const claim = String(c.claimType ?? '').toUpperCase() as ClaimType;
  return {
    ...c,
    worldCategory: WORLD_CATEGORIES.includes(category) ? category : 'GENERAL_KNOWLEDGE',
    associationLevel: ASSOCIATION_LEVELS.includes(level) ? level : 'CONTEXTUAL',
    claimType: CLAIM_TYPES.includes(claim) ? claim : 'ANALOGY',
    sources: Array.isArray(c.sources) ? c.sources : [],
    scoreBreakdown: {
      directness: Number(c.scoreBreakdown?.directness ?? 0),
      familiarity: Number(c.scoreBreakdown?.familiarity ?? 0),
      simplicity: Number(c.scoreBreakdown?.simplicity ?? 0),
      memorability: Number(c.scoreBreakdown?.memorability ?? 0),
      relevance: Number(c.scoreBreakdown?.relevance ?? 0),
      confusionRisk: Number(c.scoreBreakdown?.confusionRisk ?? 0)
    }
  };
}

/**
 * Enforces the diversity rules in code, since the prompt alone doesn't hold: one candidate per
 * worldRef, then round-robin across categories so the candidates actually tried first (the
 * pipeline stops at the first approval) are not all from one world.
 */
export function diversify(candidates: ConnectionCandidate[]): ConnectionCandidate[] {
  const seen = new Set<string>();
  const byCategory = new Map<string, ConnectionCandidate[]>();
  for (const c of candidates) {
    const key = normalizeInterestName(c.worldRef);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const bucket = byCategory.get(c.worldCategory) ?? [];
    bucket.push(c);
    byCategory.set(c.worldCategory, bucket);
  }

  const buckets = [...byCategory.values()];
  const ordered: ConnectionCandidate[] = [];
  for (let i = 0; buckets.some((b) => i < b.length); i++) {
    for (const bucket of buckets) if (i < bucket.length) ordered.push(bucket[i]!);
  }
  return ordered;
}

export function normalizeInterestName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // strip Arabic diacritics/tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function isKnownInterest(worldRef: string, profile: UserMemoryProfile): boolean {
  const target = normalizeInterestName(worldRef);
  if (!target) return false;

  const savedNames = [
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

  return savedNames.some((name) => {
    const n = normalizeInterestName(name);
    return n.length > 0 && (target.includes(n) || n.includes(target));
  });
}

/** Nudges which hook type to prefer, never overrides accuracy. */
function describeStylePreference(styles: string[]): string {
  if (styles.length === 0) return '';
  const hints: Record<string, string> = {
    fast: 'يفضّل الطالب الروابط المباشرة (رقم مطابق أو حقيقة مشهورة) قبل أي شي أبطأ.',
    funny: 'يفضّل الطالب لمسة خفيفة الظل بـwhyOneLiner إذا كانت طبيعية، بدون المساس بالدقة.',
    smart: 'يفضّل الطالب روابط القصة/النمط والحقائق المشهورة إذا كانت تُفهم فورًا.',
    visual: 'يفضّل الطالب روابط الشكل كل ما كانت ممكنة وقوية.',
    phonetic: 'يفضّل الطالب روابط النطق كل ما وجدت تشابه صوتي حقيقي.'
  };
  const lines = styles.map((s) => hints[s]).filter(Boolean);
  return lines.length ? `\n\nأسلوب الطالب المفضل: ${lines.join(' ')}` : '';
}

function describeWorlds(profile: UserMemoryProfile): string {
  const parts: string[] = [];
  if (profile.preferredWorlds.length) {
    parts.push(`عوالم يحبها (أولوية، مو حدود): ${profile.preferredWorlds.map((w) => WORLD_LABEL_AR[w] ?? w).join('، ')}`);
  }
  const named: string[] = [];
  if (profile.favoriteShows.length) named.push(`مسلسلات: ${profile.favoriteShows.join(', ')}`);
  if (profile.favoriteMovies.length) named.push(`أفلام: ${profile.favoriteMovies.join(', ')}`);
  if (profile.favoriteAnime.length) named.push(`أنمي: ${profile.favoriteAnime.join(', ')}`);
  if (profile.favoriteGames.length) named.push(`ألعاب: ${profile.favoriteGames.join(', ')}`);
  if (profile.favoriteTeams.length) named.push(`فرق: ${profile.favoriteTeams.join(', ')}`);
  if (profile.favoritePlayers.length) named.push(`لاعبين: ${profile.favoritePlayers.join(', ')}`);
  if (profile.favoriteCars.length) named.push(`سيارات: ${profile.favoriteCars.join(', ')}`);
  if (profile.favoriteMusic.length) named.push(`موسيقى: ${profile.favoriteMusic.join(', ')}`);
  if (profile.favoritePeople.length) named.push(`مشاهير: ${profile.favoritePeople.join(', ')}`);
  if (named.length) {
    parts.push(`أسماء سمّاها بنفسه (استخدم أي واحد منها بمرشح واحد بالكثير، وفقط لو فيه حقيقة محددة تربطه):\n${named.join('\n')}`);
  }
  if (parts.length === 0) {
    parts.push('ما حدد اهتمامات بعد — استخدم مراجع مشهورة جدًا يعرفها أي طالب جامعي سعودي.');
  }
  return parts.join('\n');
}

/**
 * Interests as a PRIOR: a familiarity nudge on top of the model's own score. A reference from a
 * domain the student likes earns a bonus even if they never named that exact title — otherwise
 * the only two names they saved would always outscore every famous series or anime.
 */
function enrichWithMemoryProfile(candidate: ConnectionCandidate, profile: UserMemoryProfile): ConnectionCandidate {
  const feedbackBonus = profile.weights[`world:${candidate.worldCategory.toLowerCase()}`] ?? 0;
  const likedWorldBonus = profile.preferredWorlds.includes(candidate.worldCategory) ? 8 : 0;
  const namedInterestBonus = isKnownInterest(candidate.worldRef, profile) ? 5 : 0;
  return {
    ...candidate,
    scoreBreakdown: {
      ...candidate.scoreBreakdown,
      familiarity: Math.max(
        0,
        Math.min(100, candidate.scoreBreakdown.familiarity + feedbackBonus + likedWorldBonus + namedInterestBonus)
      )
    }
  };
}
