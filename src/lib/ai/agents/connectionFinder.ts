import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { normalizeFactType } from '@/lib/ai/factTypes';
import type {
  Anchor,
  AnchorKind,
  BridgeCandidate,
  BridgeConnectionType,
  ExtractedConcept,
  FactType,
  WorldCategory
} from '@/lib/ai/types';

/*
 * GENERAL DISCOVERY — one of three parallel discovery passes (general, phonetic, interest). It
 * classifies the fact, splits it into anchors and tries every allowed association type, then
 * hands everything to the judge. It never receives the student's interests (the interest pass
 * does that, under its own guard), and it carries no named examples: concrete names in a prompt
 * get copied back as "answers" for unrelated facts.
 */

export const WORLD_CATEGORIES: WorldCategory[] = [
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

export const CONNECTION_TYPES: BridgeConnectionType[] = [
  'NUMERIC',
  'PHONETIC',
  'VISUAL',
  'CHARACTER',
  'SCENE',
  'WORD',
  'CONCEPTUAL',
  'MINI_STORY'
];

const ANCHOR_KINDS: AnchorKind[] = ['NUMBER', 'RANGE', 'MEASUREMENT', 'TERM', 'NAME', 'SEQUENCE', 'PROPERTY', 'RELATION', 'VISUAL'];

/** What each association type means — shared by every discovery pass and the judge. */
export const TYPE_GUIDE =
  'أنواع الربط:\n' +
  '- NUMERIC: نفس الرقم بالضبط في شي مشهور (رقم، عدد، سنة). فقط إذا المعلومة فيها رقم.\n' +
  '- PHONETIC: كلمة من المعلومة تنطق بوضوح مثل كلمة عربية أو اسم معروف (مقطع كامل، مو حرف أو حرفين).\n' +
  '- VISUAL: شكل أو صورة أو رمز معروف يطابق المصطلح أو المعلومة مباشرة.\n' +
  '- CHARACTER: شخصية (أفلام، مسلسلات، أنمي، ألعاب، رياضة، مشاهير) صفتها المعروفة هي نفس المعلومة.\n' +
  '- SCENE: حدث أو مشهد أو مكان أو غرض أو عبارة مشهورة حقيقية من عمل معروف تطابق المعلومة.\n' +
  '- WORD: الكلمة الجديدة ← كلمة يعرفها الطالب (أصل مشترك، معنى، أو جزء من كلمة مألوفة).\n' +
  '- CONCEPTUAL: مفهوم يومي مشابه بوضوح.\n' +
  '- MINI_STORY: آخر حل فقط — جملة واحدة قصيرة جدًا.\n';

/** The rules every association must follow — shared by every discovery pass. */
export const ASSOCIATION_RULES =
  'قواعد صارمة:\n' +
  '- الهدف: معلومة جديدة ← ذكرى مألوفة، تنفهم بنظرة وحدة. مو شرح.\n' +
  '- bridgeLine بصيغة "عنصر → مرجع"، 6 كلمات بالكثير. MINI_STORY جملة وحدة 12 كلمة بالكثير.\n' +
  '- نبي الرابط "الواضح" مو "الممكن": لو يحتاج تبرير أو سلسلة خطوات (أ ← ب ← ج) لا تكتبه.\n' +
  '- ممنوع "اسم مشهور = صفة عامة" (فلان = القوة/الدقة/الأهمية).\n' +
  '- لا تكذب عشان تصنع رابط: إذا التشابه الصوتي ضعيف لا تدّعيه، وإذا ما أنت متأكد من حقيقة ' +
  '(رقم، شخصية، حدث) لا تكتب المرشح.\n' +
  '- evidence = الحقيقة الخارجية اللي يقوم عليها الرابط، قابلة للتحقق. confidence = ثقتك فيها (0-1). ' +
  'relationDistance = عدد الخطوات الذهنية (1 = مباشر).\n' +
  '- ابدع في الزاوية، مو في الحقائق: كل رقم واسم وحدث ومشهد لازم يكون صحيح 100%. ' +
  'رقم عن شخص أو فريق أو عمل (رقم قميص، عدد مواسم، نسبة) لا تكتبه إلا إذا متأكد منه حرفيًا.\n' +
  '- أي اسم في أي تعليمات سابقة ليس إجابة جاهزة ولا قالب.\n' +
  '- إذا ما فيه رابط قوي، أرجع candidates فاضية — "ما فيه رابط قوي" نتيجة صحيحة.\n';

const SYSTEM_PROMPT =
  '[AGENT:association_discovery] أنت محرك اكتشاف روابط ذاكرة. المعلومة هي الأساس: تبدأ منها دائمًا.\n\n' +
  'الخطوات:\n' +
  '1) factType: صنّف المعلومة (NUMBER, NAME, TERM, ENGLISH_WORD, ACRONYM, LIST, PROCESS, CONCEPT, ' +
  'LOCATION, TIME, CAUSE_EFFECT, OTHER). التصنيف الآلي مرفق — صحّحه إذا غلط.\n' +
  '2) anchors: فكّك المعلومة لعناصر صغيرة (مصطلح، رقم، صفة، علاقة...) وأعطِ كل عنصر relevance (0-1) ' +
  '= قيمته للحفظ. memoryTarget = الجزء اللي غالبًا بينساه الطالب.\n' +
  '3) candidates: لكل عنصر مهم، جرّب كل نوع ربط مسموح (القائمة مرفقة مرتبة حسب الأنسب) وقارن — ' +
  'لا توقف عند أول نوع. ولّد 10 إلى 14 مرشح متنوع الأنواع، و3 مرشحين رقميين بالكثير.\n' +
  '4) ابدع: الرابط العادي سهل — دوّر على الزاوية اللي تخلي الطالب يبتسم ويقول "آه!": صوت يحمل ' +
  'المعنى نفسه، صورة ذهنية حية وغريبة، مشهد مشهور يمشي بنفس آلية المعلومة، شي يومي سعودي يشتغل ' +
  'بنفس الطريقة، أو كلمة عربية تشرح المصطلح بنفسها. غطِّ 3 عوالم مختلفة على الأقل.\n\n' +
  TYPE_GUIDE +
  '\n' +
  ASSOCIATION_RULES +
  '\nأرجع JSON فقط:\n' +
  '{"factType":"...","memoryTarget":"...",' +
  `"anchors":[{"text":"...","kind":"${ANCHOR_KINDS.join('|')}","relevance":0.0}],` +
  '"candidates":[{"anchor":"العنصر من المعلومة",' +
  `"connectionType":"${CONNECTION_TYPES.join('|')}",` +
  `"worldCategory":"${WORLD_CATEGORIES.join('|')}",` +
  '"worldRef":"المرجع المألوف","soundsLike":"(PHONETIC فقط) نطق الكلمة بالعربي",' +
  '"matchedSound":"(PHONETIC فقط) الجزء المطابق من المرجع","atomEmoji":"إيموجي واحد",' +
  '"bridgeLine":"عنصر → مرجع","whyOneLiner":"جملة قصيرة","evidence":"...","confidence":0.0,"relationDistance":1}]}';

export interface DiscoveryResult {
  factType: FactType;
  memoryTarget: string;
  anchors: Anchor[];
  candidates: BridgeCandidate[];
}

export interface DiscoveryOptions {
  userId: string;
  factType: FactType;
  allowedTypes: BridgeConnectionType[];
  detectedAnchors: Anchor[];
  excludeRefs: string[];
  round: number;
  /** Round 2+: why the previous round's candidates failed, so expansion goes somewhere new. */
  priorRejections: string[];
}

export function expansionText(opts: { round: number; priorRejections: string[]; excludeRefs: string[] }): string {
  const expansion =
    opts.round > 1
      ? '\n\nهذي جولة توسيع: مرشحي الجولة السابقة انرفضت لهالأسباب — لا تكررها:\n' +
        opts.priorRejections.map((r) => `- ${r}`).join('\n') +
        '\nجرّب عناصر وأنواع ربط ومراجع مختلفة.'
      : '';
  const exclusions = opts.excludeRefs.length
    ? `\nمراجع ممنوعة (استُخدمت أو انرفضت): ${opts.excludeRefs.join('، ')}`
    : '';
  return expansion + exclusions;
}

export function factMessage(concept: ExtractedConcept, opts: { factType: FactType; allowedTypes: BridgeConnectionType[]; detectedAnchors: Anchor[] }): string {
  const detected = opts.detectedAnchors.length
    ? opts.detectedAnchors.map((a) => `${a.text} (${a.kind})`).join('، ')
    : 'لا يوجد';
  return (
    `المعلومة (لا تغيّرها): ${concept.atomLabel}\n` +
    `السياق: ${concept.title} — ${concept.summary}\n` +
    `التصنيف الآلي: ${opts.factType}\n` +
    `أنواع الربط المسموحة (الأنسب أولًا): ${opts.allowedTypes.join('، ')}\n` +
    `عناصر مكتشفة آليًا: ${detected}`
  );
}

export async function discoverBridges(concept: ExtractedConcept, opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_finder',
    userId: opts.userId,
    responseFormat: 'json',
    // Discovery is deliberately loose — creative angles here; truth is enforced afterwards by the
    // code gates, the judge (a separate tier) and the final fact check.
    temperature: 0.85,
    maxTokens: 6144,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + expansionText(opts) },
      { role: 'user', content: factMessage(concept, opts) }
    ]
  });

  if (result.isMock) {
    return { factType: opts.factType, memoryTarget: concept.atomLabel, anchors: opts.detectedAnchors, candidates: [] };
  }

  const parsed = parseJsonResponse<{ factType?: string; memoryTarget?: string; anchors?: unknown[]; candidates?: unknown[] }>(
    result.text
  );
  return {
    factType: normalizeFactType(parsed.factType, opts.factType),
    memoryTarget: typeof parsed.memoryTarget === 'string' && parsed.memoryTarget ? parsed.memoryTarget : concept.atomLabel,
    anchors: (parsed.anchors ?? []).map(normalizeAnchor).filter((a): a is Anchor => a !== null),
    candidates: parseCandidates(parsed.candidates, `r${opts.round}c`, concept.atomEmoji)
  };
}

export function parseCandidates(raw: unknown[] | undefined, idPrefix: string, fallbackEmoji: string): BridgeCandidate[] {
  return (raw ?? [])
    .map((c, i) => normalizeCandidate(c, `${idPrefix}${i + 1}`, fallbackEmoji))
    .filter((c): c is BridgeCandidate => c !== null);
}

function normalizeAnchor(raw: unknown): Anchor | null {
  const a = raw as Partial<Anchor> | null;
  if (!a || typeof a.text !== 'string' || !a.text.trim()) return null;
  const kind = String(a.kind ?? '').toUpperCase() as AnchorKind;
  return {
    text: a.text.trim(),
    kind: ANCHOR_KINDS.includes(kind) ? kind : 'TERM',
    relevance: clamp01(Number(a.relevance))
  };
}

/** Coerces model output into the DB-safe shape; drops anything missing the essentials. */
export function normalizeCandidate(raw: unknown, id: string, fallbackEmoji: string): BridgeCandidate | null {
  const c = raw as Record<string, unknown> | null;
  if (!c) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const worldRef = str(c.worldRef);
  const bridgeLine = str(c.bridgeLine);
  if (!worldRef || !bridgeLine) return null;

  const category = str(c.worldCategory).toUpperCase() as WorldCategory;
  const type = str(c.connectionType).toUpperCase() as BridgeConnectionType;
  const distance = Math.round(Number(c.relationDistance));

  const soundsLike = str(c.soundsLike);
  const matchedSound = str(c.matchedSound);
  const connectionType: BridgeConnectionType = CONNECTION_TYPES.includes(type) ? type : (LEGACY_TYPES[type] ?? 'CONCEPTUAL');

  return {
    id,
    anchor: str(c.anchor),
    connectionType,
    worldCategory: WORLD_CATEGORIES.includes(category) ? category : 'GENERAL_KNOWLEDGE',
    worldRef,
    atomEmoji: str(c.atomEmoji) || fallbackEmoji,
    bridgeLine,
    whyOneLiner: str(c.whyOneLiner),
    evidence: str(c.evidence),
    confidence: clamp01(Number(c.confidence)),
    relationDistance: Number.isFinite(distance) && distance > 0 ? distance : 3,
    ...(connectionType === 'PHONETIC' && soundsLike && matchedSound
      ? { phonetic: { term: str(c.anchor), soundsLike, matchedSound } }
      : {})
  };
}

/** Old type names a model may still echo, mapped onto the A-H types. */
export const LEGACY_TYPES: Record<string, BridgeConnectionType> = {
  DIRECT: 'CHARACTER',
  MEASUREMENT: 'NUMERIC',
  SEMANTIC: 'CONCEPTUAL',
  STRUCTURAL: 'CONCEPTUAL',
  NARRATIVE: 'SCENE',
  POP_CULTURE: 'CHARACTER',
  SPORTS: 'CHARACTER',
  EVERYDAY: 'CONCEPTUAL',
  STORY: 'MINI_STORY'
};

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
