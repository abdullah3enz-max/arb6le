import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type {
  Anchor,
  AnchorKind,
  BridgeCandidate,
  BridgeConnectionType,
  ExtractedConcept,
  WorldCategory
} from '@/lib/ai/types';

/*
 * DISCOVERY — wide on purpose. It never receives the student's interests (those are only a
 * ≤5-point tie-breaker applied after verification), and it contains no named examples: every
 * concrete name that used to live in this prompt was copied back as an "answer" for unrelated
 * facts. The search always starts from the fact's own anchors.
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
  'DIRECT',
  'NUMERIC',
  'MEASUREMENT',
  'PHONETIC',
  'SEMANTIC',
  'STRUCTURAL',
  'VISUAL',
  'NARRATIVE',
  'POP_CULTURE',
  'SPORTS',
  'EVERYDAY'
];

const ANCHOR_KINDS: AnchorKind[] = ['NUMBER', 'RANGE', 'MEASUREMENT', 'TERM', 'NAME', 'SEQUENCE', 'PROPERTY', 'RELATION', 'VISUAL'];

const SYSTEM_PROMPT =
  '[AGENT:bridge_discovery] أنت محرك اكتشاف جسور ذاكرة. المعلومة هي الأساس: تبدأ منها دائمًا، ' +
  'ولا تبدأ أبدًا من شخص أو فريق أو مسلسل أو أي اهتمام.\n\n' +
  'الخطوات:\n' +
  '1) memoryTarget: وش الجزء من هذي المعلومة اللي غالبًا بيصعب على الطالب يتذكره؟ (رقم، مدى، وحدة، ' +
  'جرعة، مدة، مصطلح، عدد مراحل، ترتيب، علاقة).\n' +
  '2) anchors: فكّك المعلومة لعناصر (أرقام، مدى، قياسات، مصطلحات، أسماء، تسلسل، خصائص، علاقات، ' +
  'أشكال) وأعطِ كل عنصر relevance من 0 إلى 1 = قيمته للحفظ (تميّزه + فرصة ربطه). الكلمات العامة ' +
  '(approximately, normal, the) قيمتها شبه صفر. العناصر المكتشفة آليًا مرفقة بالطلب — اعتمدها وأضف عليها.\n' +
  '3) candidates: ابدأ بالعنصر اللي هو memoryTarget ثم الأعلى relevance، وولّد 15 إلى 20 مرشح. ' +
  'نوع العنصر هو اللي يحدد وين تدوّر:\n' +
  '   - رقم/مدى/قياس ← نفس الرقم في شي مشهور فعلًا (رقم، عدد، سنة، مدة)، أو شي يومي بنفس الوزن/الطول/المدة.\n' +
  '   - مصطلح/كلمة ← النطق (كلمة عربية أو لهجة سعودية أو اسم معروف ينطق مثل مقطع كامل منها)، ' +
  'أصل الكلمة ومعناها، التشابه الكتابي.\n' +
  '   - تسلسل/عملية/مراحل ← شي مألوف بنفس عدد المراحل وترتيبها (روتين يومي، لعبة، قصة، مباراة).\n' +
  '   - شكل/لون/ترتيب ← أشياء يومية أو رموز أو مشاهد بصرية معروفة.\n' +
  '   - علاقة/وظيفة ← تشبيه بنيوي بشي يومي، أو قصة/مشهد يمشي بنفس النمط.\n' +
  '   كل المجالات مسموحة (مسلسلات، أفلام، أنمي، ألعاب، كورة، موسيقى، مشاهير، سيارات، تاريخ، ' +
  'حياة يومية، لغة، أمثال) — لكن فقط إذا العلاقة حقيقية ومباشرة مع العنصر نفسه.\n\n' +
  'قواعد صارمة:\n' +
  '- الاتجاه دائمًا: عنصر من المعلومة ← مرجع حقيقي. ممنوع تختار مرجع أول ثم تدوّر له علاقة.\n' +
  '- كل مرشح بمرجع مختلف، وغطِّ عنصرين على الأقل وأنواع ربط مختلفة.\n' +
  '- evidence = الحقيقة الخارجية اللي يقوم عليها الرابط، بصيغة قابلة للتحقق من شخص مستقل. ' +
  'إذا ما أنت متأكد منها حرفيًا (خصوصًا الأرقام والأعداد)، لا تكتب المرشح إطلاقًا.\n' +
  '- confidence = ثقتك إن evidence صحيحة حرفيًا (0-1). relationDistance = عدد الخطوات الذهنية بين ' +
  'العنصر والمرجع (1 = مباشر).\n' +
  '- ممنوع "اسم مشهور = صفة عامة" (فلان = الدقة/القوة/العمق/التأثير) — هذا مو رابط.\n' +
  '- bridgeLine سطر قصير جدًا "عنصر ← مرجع" يبيّن التطابق نفسه. whyOneLiner جملة واحدة تسمّي التطابق بالضبط.\n' +
  '- أي اسم يظهر بأي تعليمات أو أمثلة سابقة ليس إجابة جاهزة ولا قالب.\n' +
  '- إذا ما فيه ولا جسر صادق، أرجع candidates فاضية — أفضل من رابط ملفّق.\n\n' +
  'أرجع JSON فقط:\n' +
  '{"memoryTarget":"...",' +
  `"anchors":[{"text":"...","kind":"${ANCHOR_KINDS.join('|')}","relevance":0.0}],` +
  '"candidates":[{"anchor":"العنصر من المعلومة",' +
  `"connectionType":"${CONNECTION_TYPES.join('|')}",` +
  `"worldCategory":"${WORLD_CATEGORIES.join('|')}",` +
  '"worldRef":"المرجع","atomEmoji":"إيموجي واحد","bridgeLine":"...","whyOneLiner":"...",' +
  '"evidence":"...","confidence":0.0,"relationDistance":1}]}';

export interface DiscoveryResult {
  memoryTarget: string;
  anchors: Anchor[];
  candidates: BridgeCandidate[];
}

export interface DiscoveryOptions {
  userId: string;
  detectedAnchors: Anchor[];
  excludeRefs: string[];
  excludeTypes: BridgeConnectionType[];
  round: number;
  /** Round 2+: why the previous round's candidates failed, so expansion goes somewhere new. */
  priorRejections: string[];
}

export async function discoverBridges(concept: ExtractedConcept, opts: DiscoveryOptions): Promise<DiscoveryResult> {
  const expansion =
    opts.round > 1
      ? '\n\nهذي جولة توسيع: مرشحي الجولة السابقة انرفضت لهالأسباب — لا تكررها:\n' +
        opts.priorRejections.map((r) => `- ${r}`).join('\n') +
        '\nجرّب عناصر ما جربتها، وأنواع ربط ومجالات مختلفة، وتعمّق (قصص، تشابه بنيوي، حياة يومية، لغة).'
      : '';
  const exclusions =
    (opts.excludeRefs.length ? `\nمراجع ممنوعة (استُخدمت أو انرفضت): ${opts.excludeRefs.join('، ')}` : '') +
    (opts.excludeTypes.length ? `\nأنواع ربط تجنّبها هالمرة: ${opts.excludeTypes.join('، ')}` : '');
  const detected = opts.detectedAnchors.length
    ? opts.detectedAnchors.map((a) => `${a.text} (${a.kind})`).join('، ')
    : 'لا يوجد';

  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_finder',
    userId: opts.userId,
    responseFormat: 'json',
    // Discovery is deliberately looser than verification: variety here, strictness later.
    temperature: 0.6,
    // 15-20 candidates plus anchors, with headroom for reasoning-style models.
    maxTokens: 8192,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + expansion + exclusions },
      {
        role: 'user',
        content:
          `المعلومة (لا تغيّرها): ${concept.atomLabel}\n` +
          `السياق: ${concept.title} — ${concept.summary}\n` +
          `نوعها: ${concept.conceptType}\n` +
          `عناصر مكتشفة آليًا: ${detected}`
      }
    ]
  });

  if (result.isMock) return { memoryTarget: concept.atomLabel, anchors: opts.detectedAnchors, candidates: [] };

  const parsed = parseJsonResponse<{ memoryTarget?: string; anchors?: unknown[]; candidates?: unknown[] }>(result.text);
  return {
    memoryTarget: typeof parsed.memoryTarget === 'string' && parsed.memoryTarget ? parsed.memoryTarget : concept.atomLabel,
    anchors: (parsed.anchors ?? []).map(normalizeAnchor).filter((a): a is Anchor => a !== null),
    candidates: (parsed.candidates ?? [])
      .map((c, i) => normalizeCandidate(c, `r${opts.round}c${i + 1}`, concept.atomEmoji))
      .filter((c): c is BridgeCandidate => c !== null)
  };
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
function normalizeCandidate(raw: unknown, id: string, fallbackEmoji: string): BridgeCandidate | null {
  const c = raw as Record<string, unknown> | null;
  if (!c) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const worldRef = str(c.worldRef);
  const bridgeLine = str(c.bridgeLine);
  if (!worldRef || !bridgeLine) return null;

  const category = str(c.worldCategory).toUpperCase() as WorldCategory;
  const type = str(c.connectionType).toUpperCase() as BridgeConnectionType;
  const distance = Math.round(Number(c.relationDistance));

  return {
    id,
    anchor: str(c.anchor),
    connectionType: CONNECTION_TYPES.includes(type) ? type : 'SEMANTIC',
    worldCategory: WORLD_CATEGORIES.includes(category) ? category : 'GENERAL_KNOWLEDGE',
    worldRef,
    atomEmoji: str(c.atomEmoji) || fallbackEmoji,
    bridgeLine,
    whyOneLiner: str(c.whyOneLiner),
    evidence: str(c.evidence),
    confidence: clamp01(Number(c.confidence)),
    relationDistance: Number.isFinite(distance) && distance > 0 ? distance : 3
  };
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
