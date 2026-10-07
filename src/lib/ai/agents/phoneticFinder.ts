import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import {
  ASSOCIATION_RULES,
  WORLD_CATEGORIES,
  expansionText,
  factMessage,
  parseCandidates
} from '@/lib/ai/agents/connectionFinder';
import type { Anchor, BridgeCandidate, BridgeConnectionType, ExtractedConcept, FactType } from '@/lib/ai/types';

/*
 * PHONETIC & WORD discovery (types B and F) — the second parallel discovery pass, and the most
 * important one for English and medical terms. It works on sound only: how the term is actually
 * pronounced, written in Arabic letters, against a real Arabic word, dialect word or well-known
 * name that sounds like a full chunk of it. It never sees the student's interests, and it must
 * not claim a sound match that isn't there — a WORD association (shared root, meaning, a familiar
 * word inside the term) is the honest alternative when the sound is weak.
 */

const SYSTEM_PROMPT =
  '[AGENT:phonetic_discovery] أنت متخصص في الربط الصوتي واللفظي للمصطلحات (خصوصًا الإنجليزية والطبية).\n\n' +
  'الخطوات:\n' +
  '1) اختر من 1 إلى 3 كلمات من المعلومة صعبة الحفظ (المصطلح نفسه أو الجزء اللي يحمل المعنى).\n' +
  '2) soundsLike: اكتب نطقها الحقيقي بالحروف العربية كما ينطقها طالب سعودي، بدون تحريف.\n' +
  '3) PHONETIC: دوّر على كلمة عربية فصحى أو سعودية/خليجية يومية، أو اسم معروف (شخصية، مسلسل، أنمي، ' +
  'لعبة، مكان، منتج)، نطقها يطابق مقطعًا كاملًا من الكلمة: مقطعين متتاليين أو أكثر، أو الكلمة كلها ' +
  'إذا قصيرة. matchedSound = الجزء المطابق بالحروف العربية.\n' +
  '   التشابه لازم يكون واضح لما تقول الكلمتين بصوت عالي. حرف أو حرفين مشتركين أو قافية بعيدة = مو تشابه.\n' +
  '4) WORD: إذا الصوت ضعيف، اربط الكلمة بكلمة يعرفها الطالب: أصل مشترك، نفس المعنى، أو كلمة ' +
  'مألوفة جزء منها. لا تسمّي هذا تشابه صوتي.\n' +
  '5) الأفضل لما الكلمة المشابهة تلمّح كمان لمعنى المعلومة.\n' +
  'ولّد من 4 إلى 8 مرشحين، worldCategory مناسب (DAILY_LIFE للكلمات اليومية، GENERAL_KNOWLEDGE ' +
  'للغة، أو فئة العمل إذا اسم شخصية/عمل).\n\n' +
  ASSOCIATION_RULES +
  '\nأرجع JSON فقط:\n' +
  '{"candidates":[{"anchor":"الكلمة من المعلومة","connectionType":"PHONETIC|WORD",' +
  `"worldCategory":"${WORLD_CATEGORIES.join('|')}",` +
  '"worldRef":"الكلمة أو الاسم المألوف","soundsLike":"نطق الكلمة بالعربي","matchedSound":"الجزء المطابق",' +
  '"atomEmoji":"إيموجي واحد","bridgeLine":"كلمة → كلمة مألوفة","whyOneLiner":"جملة قصيرة",' +
  '"evidence":"معنى الكلمة المألوفة أو مصدر الاسم","confidence":0.0,"relationDistance":1}]}';

export interface PhoneticOptions {
  userId: string;
  factType: FactType;
  allowedTypes: BridgeConnectionType[];
  detectedAnchors: Anchor[];
  excludeRefs: string[];
  round: number;
  priorRejections: string[];
}

export async function discoverPhoneticBridges(concept: ExtractedConcept, opts: PhoneticOptions): Promise<BridgeCandidate[]> {
  const result = await routedComplete({
    tier: 'strong',
    agent: 'phonetic_finder',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0.5,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + expansionText(opts) },
      { role: 'user', content: factMessage(concept, opts) }
    ]
  });
  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ candidates?: unknown[] }>(result.text);
  return parseCandidates(parsed.candidates, `r${opts.round}p`, concept.atomEmoji).filter(
    (c) => c.connectionType === 'PHONETIC' || c.connectionType === 'WORD'
  );
}
