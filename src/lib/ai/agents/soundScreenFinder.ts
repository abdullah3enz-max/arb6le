import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import { CONNECTION_TYPES, WORLD_CATEGORIES, normalizeCandidate } from '@/lib/ai/agents/connectionFinder';
import type { Anchor, BridgeCandidate, ExtractedConcept } from '@/lib/ai/types';

/*
 * SOUND & SCREEN discovery — a second, specialised discovery pass that runs beside the general
 * one. It hunts two things the general pass under-produces:
 *   1) sound-alike bridges: a key term of the fact that is pronounced like a name, word or
 *      catchphrase from a series or anime;
 *   2) series/anime bridges: a character, scene, count or plot beat that genuinely matches the
 *      fact's number, sequence, structure or function.
 * Like the general pass, it never sees the student's interests and carries no named examples
 * (named examples get copied back as answers). Everything it returns goes through the same
 * strict verifier.
 */

const SYSTEM_PROMPT =
  '[AGENT:sound_screen_discovery] أنت متخصص في جسور الذاكرة من المسلسلات والأنمي، وخصوصًا ' +
  'التشابه الصوتي. المعلومة هي الأساس دائمًا — تبدأ منها، مو من مسلسل أو شخصية.\n\n' +
  'القسم 1 — التشابه الصوتي (PHONETIC):\n' +
  'أ) اختر من 1 إلى 3 كلمات مفتاحية صعبة الحفظ في المعلومة (المصطلح نفسه، اسم، وحدة، أو جزء الكلمة ' +
  'اللي يحمل المعنى).\n' +
  'ب) اكتب نطق كل كلمة بالحروف العربية كما يقولها طالب سعودي (soundsLike) وقسّمها لمقاطع ذهنيًا.\n' +
  'ج) دوّر على اسم شخصية، أو اسم مسلسل/أنمي، أو كلمة أو عبارة مشهورة تنقال فيه (مسلسلات سعودية ' +
  'وخليجية وعربية وتركية وكورية وأجنبية، وأنمي ياباني: أسماء شخصيات، هجمات، ألقاب، عبارات) ' +
  'نطقها يطابق مقطعًا كاملًا من الكلمة: مقطعين متتاليين أو أكثر، أو المقطع الرئيسي كله إذا الكلمة قصيرة. ' +
  'اكتب الجزء المطابق من المرجع بالحروف العربية (matchedSound).\n' +
  'د) الأفضل لما الشخصية أو المشهد يلمّح كمان لمعنى المعلومة — اذكر هذا في whyOneLiner.\n' +
  'ممنوع: حرف أو حرفين مشتركين فقط، أو قافية بعيدة، أو تغيير نطق المصطلح عشان يركب.\n\n' +
  'القسم 2 — المسلسلات والأنمي (NARRATIVE / NUMERIC / STRUCTURAL / VISUAL / POP_CULTURE):\n' +
  'شخصية أو مشهد أو حدث أو عدد حقيقي في مسلسل أو أنمي يطابق عنصرًا من المعلومة فعلًا: نفس الرقم ' +
  '(عدد أعضاء، مواسم، أخوة، قوى…)، نفس تسلسل المراحل، نفس الوظيفة أو الدور، أو نفس الشكل.\n\n' +
  'قواعد صارمة:\n' +
  '- ولّد من 8 إلى 12 مرشح: نصفهم تقريبًا صوتي إذا لقيت صادقين، والباقي من القسم 2.\n' +
  '- كل مرشح بمرجع مختلف. worldCategory = SERIES أو ANIME أو CHARACTERS أو MOVIES.\n' +
  '- evidence = حقيقة قابلة للتحقق إن الاسم/العبارة/العدد موجود فعلًا بهذا المسلسل أو الأنمي ' +
  '(اذكر اسم العمل). إذا مو متأكد إن الشخصية أو العبارة موجودة بالضبط، لا تكتب المرشح.\n' +
  '- bridgeLine سطر قصير "الكلمة ← المرجع" يبيّن التطابق (للصوتي: اكتب المقطع المشترك).\n' +
  '- أي اسم يظهر بأي تعليمات سابقة ليس إجابة جاهزة ولا قالب.\n' +
  '- إذا ما فيه جسر صادق، أرجع candidates فاضية — أفضل من رابط ملفّق.\n\n' +
  'أرجع JSON فقط:\n' +
  '{"candidates":[{"anchor":"الكلمة أو العنصر من المعلومة",' +
  `"connectionType":"${CONNECTION_TYPES.join('|')}",` +
  `"worldCategory":"${WORLD_CATEGORIES.join('|')}",` +
  '"worldRef":"الشخصية/العبارة (اسم العمل)","soundsLike":"نطق الكلمة بالعربي (للصوتي فقط)",' +
  '"matchedSound":"الجزء المطابق من المرجع (للصوتي فقط)","atomEmoji":"إيموجي واحد",' +
  '"bridgeLine":"...","whyOneLiner":"...","evidence":"...","confidence":0.0,"relationDistance":1}]}';

export interface SoundScreenOptions {
  userId: string;
  memoryTarget: string;
  detectedAnchors: Anchor[];
  excludeRefs: string[];
  round: number;
  priorRejections: string[];
}

export async function discoverSoundScreenBridges(
  concept: ExtractedConcept,
  opts: SoundScreenOptions
): Promise<BridgeCandidate[]> {
  const expansion =
    opts.round > 1
      ? '\n\nجولة توسيع: هذي انرفضت — لا تكررها، وجرّب كلمات ومقاطع وأعمال مختلفة:\n' +
        opts.priorRejections.map((r) => `- ${r}`).join('\n')
      : '';
  const exclusions = opts.excludeRefs.length
    ? `\nمراجع ممنوعة (استُخدمت أو انرفضت): ${opts.excludeRefs.join('، ')}`
    : '';

  const result = await routedComplete({
    tier: 'strong',
    agent: 'sound_screen_finder',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0.7,
    maxTokens: 6144,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + expansion + exclusions },
      {
        role: 'user',
        content:
          `المعلومة (لا تغيّرها): ${concept.atomLabel}\n` +
          `السياق: ${concept.title} — ${concept.summary}\n` +
          `الجزء الأصعب حفظًا: ${opts.memoryTarget}\n` +
          `عناصر مكتشفة آليًا: ${opts.detectedAnchors.map((a) => a.text).join('، ') || 'لا يوجد'}`
      }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ candidates?: unknown[] }>(result.text);
  return (parsed.candidates ?? [])
    .map((c, i) => normalizeCandidate(c, `r${opts.round}s${i + 1}`, concept.atomEmoji))
    .filter((c): c is BridgeCandidate => c !== null)
    // A sound-alike claim without the two sounds to compare can't be verified — drop it.
    .filter((c) => c.connectionType !== 'PHONETIC' || c.phonetic !== undefined);
}
