import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { getSearchProvider } from '@/lib/ai/providers/search';
import type { ConnectionCandidate, ExtractedConcept, UserMemoryProfile } from '@/lib/ai/types';

/**
 * The four core rules (item 20) — kept verbatim in every Connection Finder call so the model
 * never drifts back toward the "explain it as a story" mode this engine explicitly rejects.
 */
const CORE_RULES =
  'القاعدة الأولى: الهدف ليس شرح المعلومة، الهدف هو أقصر جسر ممكن بين معلومة غريبة وشيء يعرفه ' +
  'ويحبه المستخدم أصلًا. القاعدة الثانية: إذا كان الرابط ما يُفهم فورًا (أكثر من ثانيتين)، ارفضه ' +
  'وولّد رابطًا آخر. القاعدة الثالثة: معلومة واحدة → رابط واحد واضح، لا تشبيهات متعددة. القاعدة ' +
  'الرابعة: لا تضحّي بالدقة العلمية أبدًا من أجل رابط ذكي — المعلومة الأصلية تبقى كما هي 100%، ' +
  'الرابط وسيلة حفظ فقط.';

/**
 * The priority ladder (item 6): always try level 1 first, only fall through when it genuinely
 * doesn't exist. Item 9 — the right ladder entry depends on the SHAPE of the fact, not habit.
 */
const LADDER_GUIDE =
  'سلّم الأولوية (جرّب المستوى 1 قبل أي شي، ولا تنزل مستوى إلا إذا ما وجدت شي أقوى):\n' +
  '1) DIRECT_MATCH — نفس الرقم/القيمة بالضبط: "7 mg" ← لاعب/شخصية رقمه 7 فعلًا.\n' +
  '2) PHONETIC — تشابه صوتي حقيقي باسم يعرفه المستخدم.\n' +
  '3) VISUAL — تشابه شكل/لون/رمز معروف.\n' +
  '4) FAMOUS_ASSOCIATION — حقيقة مشهورة وصحيحة عن الاهتمام: "10" ← "Messi" (لأن رقمه 10 فعلًا، ليس تخمينًا).\n' +
  '5) CONTEXTUAL — حدث/شخصية/قصة يعرفها المستخدم بنفس النمط، فقط إذا فشلت كل المستويات السابقة.\n\n' +
  'مهم جدًا لمستوى PHONETIC: لا تكتفِ بتشابه صوتي سطحي مع اسم المصطلح كما هو. ابحث أولًا عن ' +
  '**الاسم العلمي/التاريخي/الأصلي الحقيقي للمصطلح نفسه** (تسمية بديلة موثّقة، اسم مكتشف، أصل ' +
  'الكلمة)، ثم جرّب التشابه الصوتي مع ذاك الاسم — هذا أعمق وأدق بكثير من تطابق رقمي عشوائي أو ' +
  'تشابه سطحي. مثال حقيقي: مفهوم "الأشعة السينية" (X-ray) اسمه العلمي الحقيقي "Röntgen" (نسبة ' +
  'لمكتشفها Wilhelm Röntgen، ويُقال طبيًا "أشعة رونتجن") — فيه تشابه صوتي حقيقي بين "رون" ' +
  'وRonaldo، وهذا رابط أعمق وأدق من مجرد قول "رقم 7 = رونالدو" بدون سياق. اسم/تسمية حقيقية ← ' +
  'تشابه صوتي مبني عليها ← ربط بالاهتمام. لا تخترع تسمية — إذا ما وجدت اسمًا بديلًا حقيقيًا ' +
  'موثّقًا للمصطلح، انزل لمستوى آخر بدل ما تلفّق واحد.\n\n' +
  'خريطة نوع المعلومة → أي مستوى تبدأ فيه: رقم → ابحث مطابقة رقمية مشهورة أولًا. كلمة/مصطلح → ' +
  'دوّر على اسمه العلمي/الأصلي الحقيقي أولًا ثم جرّب تشابه صوتي عليه. عملية/خطوات → دور على ' +
  'مشهد أو حدث مشابه بنفس الترتيب. قائمة → قصة أو ترتيب مألوف. معلومة طبية/علمية → لا تغيّر ' +
  'الرقم أو الحقيقة نفسها إطلاقًا، فقط اربطها.';

/**
 * STEP 9: search for real bridges inside the user's worlds.
 * Two lanes:
 *  - KNOWLEDGE_BASE lane: stable, non-time-sensitive facts (a player's real jersey number,
 *    a film's real plot) — LLM may draft from training knowledge, but every one still goes
 *    through Fact Checker.
 *  - LIVE_SEARCH lane: sports/recent events — only proposed where a live SearchProvider
 *    result actually backs the claim. If unconfigured, this lane is skipped entirely.
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
    ? 'LIVE_SEARCH متاح — لو اقترحت رابط من كرة القدم يعتمد على معلومة حديثة، حدد claimType وسنتحقق منه فعليًا.'
    : 'LIVE_SEARCH غير متاح الآن — لا تقترح أي رابط يعتمد على نتيجة مباراة أو إحصائية حديثة؛ استخدم فقط حقائق ثابتة معروفة (رقم قميص تاريخي، اسم فريق)، وإلا أرجع مصفوفة فاضية.';

  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_finder',
    userId: opts.userId,
    responseFormat: 'json',
    // Reasoning-heavy free models spend a lot of the budget on hidden chain-of-thought before
    // ever writing the JSON — too small a cap here is what truncates the JSON mid-object.
    maxTokens: 4096,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:connection_finder] أنت محرك ربط ذاكرة (Memory Association Engine)، لست مدرّس ' +
          'يشرح. ' +
          CORE_RULES +
          '\n\n' +
          LADDER_GUIDE +
          '\n\nممنوع منعًا باتًا: أي جملة طويلة، أي "تخيل أن..."، أي قصة مفصّلة. الناتج بالكامل ' +
          '(bridgeLine) يجب أن يكون سطرًا واحدًا قصيرًا جدًا مثل "Ronaldo = 7" أو "Ronaldo #7"، ' +
          'ليس أكثر. whyOneLiner جملة واحدة أو جملتين بحد أقصى، تُعرض فقط لما يضغط المستخدم "ليش؟"، ' +
          'لكنها يجب أن تسمّي الآلية الحقيقية وراء الربط بوضوح (الاسم العلمي المستخدم، أو الحقيقة ' +
          'المشهورة نفسها) — ممنوع جملة فاضية زي "لأنه معروف بهذا" بدون ذكر الحقيقة الفعلية. ' +
          'إذا لم توجد association قوية ومباشرة، أرجع مصفوفة candidates فاضية — هذا أفضل من رابط ' +
          'ضعيف يحتاج تفكير. ' +
          'قاعدة صارمة على worldRef: يجب أن يكون اسمًا مذكورًا حرفيًا بقائمة "عوالم المستخدم" ' +
          'بالأسفل — لا تقترح اسمًا مشابهًا أو من نفس الفئة لكنه غير مكتوب فيها (مثلًا: المستخدم ' +
          'ذاكر "Messi" فقط بكرة القدم، فممنوع تقترح "Ronaldo" أو أي لاعب ثاني حتى لو الرابط أقوى). ' +
          'إذا ما وجدت association قوية داخل القائمة المذكورة فقط، أرجع مصفوفة فاضية، ولا تنزل ' +
          'لاسم خارجها أبدًا. ' +
          liveSearchNote +
          (opts.excludeWorldRefs?.length
            ? ` لا تكرر هذه الزوايا المستخدمة سابقًا: ${opts.excludeWorldRefs.join(', ')}.`
            : '') +
          ' أرجع JSON: {"candidates": [{' +
          '"associationLevel":"DIRECT_MATCH|PHONETIC|VISUAL|FAMOUS_ASSOCIATION|CONTEXTUAL",' +
          '"worldCategory","worldRef","atomEmoji","atomLabel","bridgeLine","whyOneLiner",' +
          '"claimType":"FACT|ANALOGY|INTERPRETATION",' +
          '"sources":[{"sourceType":"KNOWLEDGE_BASE|LIVE_SEARCH","confidence"(0-1),"evidenceSnippet","title","url"}],' +
          '"scoreBreakdown":{"directness","familiarity","simplicity","memorability","relevance","confusionRisk"} ' +
          '(كل قيمة 0-100، confusionRisk أعلى = أسوأ)}]}'
      },
      {
        role: 'user',
        content:
          `المعلومة (لا تغيّرها): ${concept.atomLabel}\nالسياق: ${concept.title} — ${concept.summary}\n` +
          `نوعها: ${concept.conceptType}\n\nعوالم المستخدم:\n${worldsDescription}` +
          describeStylePreference(profile.connectionStyles)
      }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ candidates: ConnectionCandidate[] }>(result.text);
  const candidates = parsed.candidates ?? [];

  // Enforce the LIVE_SEARCH gate in code, not just in the prompt: strip any candidate that
  // cites LIVE_SEARCH while the provider is unconfigured. Same treatment for worldRef — the
  // prompt tells the model to stick to the user's saved interests, but models drift, so a
  // candidate naming anything outside the actual saved list never reaches the user.
  return candidates
    .filter((c) => search.isLive || !c.sources.some((s) => s.sourceType === 'LIVE_SEARCH'))
    .filter((c) => isKnownInterest(c.worldRef, profile))
    .map((c) => enrichWithMemoryProfile(c, profile));
}

function normalizeInterestName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // strip Arabic diacritics/tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Hard gate: worldRef must actually be one of the user's saved interests, not just something
 * the model believes is plausible for that category. Matches loosely (either name contains the
 * other, after normalization) since the model may return "Cristiano Ronaldo" for a saved "Ronaldo". */
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

/** Item 15 STEP 3 — nudges which ladder level / tone to prefer, never overrides accuracy. */
function describeStylePreference(styles: string[]): string {
  if (styles.length === 0) return '';
  const hints: Record<string, string> = {
    fast: 'يفضّل المستخدم DIRECT_MATCH و FAMOUS_ASSOCIATION قبل أي مستوى أبطأ.',
    funny: 'يفضّل المستخدم whyOneLiner بلمسة خفيفة الظل إذا كان طبيعيًا، بدون المساس بالدقة.',
    smart: 'يفضّل المستخدم FAMOUS_ASSOCIATION و CONTEXTUAL إذا كانت تُفهم فورًا.',
    visual: 'يفضّل المستخدم مستوى VISUAL كل ما كان ممكنًا وقويًا.',
    phonetic: 'يفضّل المستخدم مستوى PHONETIC كل ما وجدت كلمة تشابه صوتي حقيقية.'
  };
  const lines = styles.map((s) => hints[s]).filter(Boolean);
  return lines.length ? `\n\nأسلوب المستخدم المفضل: ${lines.join(' ')}` : '';
}

function describeWorlds(profile: UserMemoryProfile): string {
  const parts: string[] = [];
  if (profile.favoriteShows.length) parts.push(`مسلسلات: ${profile.favoriteShows.join(', ')}`);
  if (profile.favoriteMovies.length) parts.push(`أفلام: ${profile.favoriteMovies.join(', ')}`);
  if (profile.favoriteAnime.length) parts.push(`أنمي: ${profile.favoriteAnime.join(', ')}`);
  if (profile.favoriteGames.length) parts.push(`ألعاب: ${profile.favoriteGames.join(', ')}`);
  if (profile.favoriteTeams.length) parts.push(`فرق كرة قدم: ${profile.favoriteTeams.join(', ')}`);
  if (profile.favoritePlayers.length) parts.push(`لاعبين: ${profile.favoritePlayers.join(', ')}`);
  if (profile.favoriteCars.length) parts.push(`سيارات: ${profile.favoriteCars.join(', ')}`);
  if (profile.favoriteMusic.length) parts.push(`موسيقى: ${profile.favoriteMusic.join(', ')}`);
  if (profile.favoritePeople.length) parts.push(`مشاهير: ${profile.favoritePeople.join(', ')}`);
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
      familiarity: Math.max(0, Math.min(100, candidate.scoreBreakdown.familiarity + bonus))
    }
  };
}
