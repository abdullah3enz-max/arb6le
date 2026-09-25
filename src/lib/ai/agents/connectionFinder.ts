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
 * STEP 9: search for real bridges — starting in the user's saved worlds (closest to personal
 * memory), but never confined to them. A concept with no honest bridge inside those interests
 * can still surface a GENERAL_KNOWLEDGE candidate (a widely-known fact, unrelated to anything
 * this student told us they like), rather than forcing a weak analogy just to stay "personal".
 * Interests are a prior that biases search and scoring, never a hard boundary on it.
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
    // Bumped for the wider 6-10 candidate target below — more real candidates per call means
    // more JSON to write, on top of the existing headroom for hidden reasoning-model tokens.
    maxTokens: 6144,
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
          'لا تتوقف عند أول فشل: إذا ما وجدت DIRECT_MATCH أو PHONETIC قوي، انزل بسلّم الأولوية ' +
          '(VISUAL ← FAMOUS_ASSOCIATION ← CONTEXTUAL) حتى تصل لأضعف مستوى ممكن. ' +
          'اهتمامات المستخدم المذكورة بالأسفل هي **دليل على أشياء يعرفها ويحبها فعلًا**، مو حدود ' +
          'صارمة تحبس بحثك: ابدأ فيها لأن الربط بيها أقرب لذاكرته الشخصية، لكن لو ما لقيت فيها إلا ' +
          'ربطًا متكلّفًا وضعيفًا (تشابه سطحي، تلاعب كلمات بلا معنى حقيقي)، لا تجبر نفسك عليه — ' +
          'جرّب معرفة عامة مشهورة يعرفها أي شخص عادي (تاريخ، جغرافيا، علوم، أرقام مشهورة، ثقافة ' +
          'شعبية) وحطّ لها worldCategory="GENERAL_KNOWLEDGE" بدل فئة من اهتماماته. القاعدة: ' +
          'رابط حقيقي وواضح خارج اهتماماته أفضل بكثير من رابط متكلّف وضعيف داخلها. ' +
          'ولّد 6 إلى 10 مرشحين مختلفين فعليًا (مو صياغات مختلفة لنفس الفكرة) — امزج بين اهتماماته ' +
          'و GENERAL_KNOWLEDGE، وجرّب أكثر من مستوى بسلّم الأولوية وأكثر من زاوية لكل مستوى، بدل ما ' +
          'تكتفي بأول شي يخطر لك أو ترجع مرشح واحد بس. عدد أكبر من المرشحين الحقيقيين يعطي فرصة أكبر ' +
          'يعدي واحد منهم فحص الجودة، حتى لو أغلبهم انرفض. ' +
          'إذا اقترحت رابطًا من فئة تخص اهتمامات المستخدم (مو GENERAL_KNOWLEDGE)، استخدم فقط اسمًا ' +
          'مذكورًا حرفيًا بقائمة "عوالم المستخدم" بالأسفل — لا تخترع اسمًا مشابهًا وتّدعي إنه من ' +
          'اهتماماته (مثلًا: المستخدم ذاكر "Messi" بس، فممنوع تقول عن "Ronaldo" إنه اهتمامه — اقترحه ' +
          'بدل ذلك كـ GENERAL_KNOWLEDGE إذا كان الرابط قوي). ' +
          'ممنوع ترفض رابطًا لمجرد إنه "مو قوي كفاية" وحده طالما هو حقيقي وغير مُخترع ويُفهم خلال ' +
          'ثوانٍ قليلة. أرجع مصفوفة فاضية فقط في حالة واحدة نادرة: ما فيه أي ربط منطقي ممكن إطلاقًا، ' +
          'لا باهتماماته ولا بمعرفة عامة — عندها الأصدق نرجّع بدون ربط بدل رابط ملفّق. ' +
          liveSearchNote +
          (opts.excludeWorldRefs?.length
            ? ` لا تكرر هذه الزوايا المستخدمة سابقًا لهذا الملف: ${opts.excludeWorldRefs.join(', ')}.`
            : '') +
          ' أرجع JSON: {"candidates": [{' +
          '"associationLevel":"DIRECT_MATCH|PHONETIC|VISUAL|FAMOUS_ASSOCIATION|CONTEXTUAL",' +
          '"worldCategory (فئة اهتمام المستخدم، أو GENERAL_KNOWLEDGE لمعرفة عامة خارج اهتماماته)",' +
          '"worldRef","atomEmoji","atomLabel","bridgeLine","whyOneLiner",' +
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
  // cites LIVE_SEARCH while the provider is unconfigured. Interests are a PRIOR, not a filter
  // (see enrichWithMemoryProfile): a candidate outside the user's saved list is never deleted
  // here for that reason alone — fact-checking and the Critic are what actually gate quality,
  // not membership in a fixed list. Only a candidate that falsely claims to BE one of the
  // user's own interests gets its personal-familiarity bonus withheld below.
  return candidates
    .filter((c) => search.isLive || !c.sources.some((s) => s.sourceType === 'LIVE_SEARCH'))
    .map((c) => enrichWithMemoryProfile(c, profile));
}

function normalizeInterestName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '') // strip Arabic diacritics/tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A scoring signal only (see enrichWithMemoryProfile), never a filter: whether worldRef actually
 * matches one of the user's saved interests, not just something the model believes is plausible
 * for that category. Matches loosely (either name contains the other, after normalization) since
 * the model may return "Cristiano Ronaldo" for a saved "Ronaldo". */
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

/**
 * Interests as a PRIOR: a familiarity nudge applied on top of whatever the model already scored,
 * never the boundary of what could be proposed in the first place (that boundary was removed from
 * the return filter above). A candidate genuinely matching one of the user's saved interests earns
 * a bonus for it; a GENERAL_KNOWLEDGE candidate — real, but not specific to this student — earns
 * none, and competes purely on how strong the connection itself is.
 */
function enrichWithMemoryProfile(candidate: ConnectionCandidate, profile: UserMemoryProfile): ConnectionCandidate {
  const weightKey = `world:${candidate.worldCategory.toLowerCase()}`;
  const categoryBonus = profile.weights[weightKey] ?? 0;
  const knownInterestBonus =
    candidate.worldCategory !== 'GENERAL_KNOWLEDGE' && isKnownInterest(candidate.worldRef, profile) ? 15 : 0;
  return {
    ...candidate,
    scoreBreakdown: {
      ...candidate.scoreBreakdown,
      familiarity: Math.max(0, Math.min(100, candidate.scoreBreakdown.familiarity + categoryBonus + knownInterestBonus))
    }
  };
}
