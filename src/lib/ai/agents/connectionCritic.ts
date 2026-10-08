import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { BridgeCandidate, BridgeVerdict, ExtractedConcept, FactType, RejectReason } from '@/lib/ai/types';

/*
 * STAGE 2 — ASSOCIATION JUDGE. Strict and independent: one separate call judges every candidate
 * at once (so they are compared against each other), at temperature 0. It never sees the
 * student's profile — only whether a candidate came from their interests, so it can catch a
 * forced one. It scores; the gates and the threshold in bridgeScoring.ts decide.
 */

export const REJECT_REASONS: RejectReason[] = [
  'weak_relation',
  'hallucination_risk',
  'too_long',
  'confusing',
  'obscure_reference',
  'forced_interest',
  'duplicate',
  'inaccurate',
  'requires_explanation'
];

const SYSTEM_PROMPT =
  '[AGENT:association_judge] أنت حكم مستقل وصارم لروابط ذاكرة. ما تولّد روابط — تحكم عليها فقط.\n' +
  'المبدأ: الرابط ينعرض فقط إذا كان واضح وصحيح وقصير ومميز ومفيد. "ممكن" مو كافي — لازم "واضح".\n' +
  'لكل مرشح أعطِ درجات من 0 إلى 10:\n' +
  '- directness: قد إيش الرابط مباشر بين عنصر المعلومة والمرجع (10 = نفس الرقم/نفس الصوت/نفس الصفة).\n' +
  '- familiarity: قد إيش المرجع معروف لطالب جامعي سعودي.\n' +
  '- memorability: هل بيساعده يتذكر المعلومة نفسها بعد أسبوع.\n' +
  '- truthfulness: هل evidence والرابط صحيحين حرفيًا (أرقام، أسماء، أحداث). أي شك = أقل من 8. ' +
  'المرشح اللي فيه verifiedFact=true مبني على حقيقة موثّقة مسبقًا — احكم على الرابط نفسه. ' +
  'إذا الدليل يناقض الرابط (مثلًا يذكر رقم مختلف)، أو الرقم تقريبي وبعيد، أو رقم عن شخص/عمل ما ' +
  'تعرفه بيقين → truthfulness 4 أو أقل.\n' +
  '- simplicity: يُفهم بنظرة؟\n' +
  '- hallucinationRisk: 0 = مستحيل يكون مختلق، 10 = غالبًا مختلق (شخصية أو حدث أو رقم ما تعرفه بيقين).\n' +
  'وأجب:\n' +
  '- twoSecondTest: هل يفهمه الطالب خلال ثانيتين بدون شرح؟\n' +
  '- coversFact: هل الرابط يحمل المعلومة نفسها (رقمها أو مصطلحها أو معناها)؟ رابط عن فكرة مجاورة ' +
  '(موقع الغدة بدل النسبة، شكل العقدة بدل "نتيجة إيجابية كاذبة") = false.\n' +
  '- specific: هل المرجع شي محدد وملموس (اسم، مشهد، غرض، كلمة معروفة)؟ مرجع عام مثل "الكيمياء" ' +
  'أو "تقييم" أو "مقياس" أو "خريطة الجسم" = false. ومجرد نطق الرقم بالعربي ("سبعين") = false.\n' +
  '- obvious: واضح (يقول "آه فهمت!") مو مجرد ممكن؟\n' +
  '- forcedInterest: (فقط إذا fromInterest=true) هل الرابط موجود بس لأن الطالب يحب هالشي؟\n' +
  '- phoneticClear: (فقط PHONETIC) انطق soundsLike و matchedSound بنفسك: هل يتطابق مقطع كامل بوضوح ' +
  'بدون تحريف نطق المصطلح؟ حرف أو حرفين = false.\n' +
  `- rejectReason: إذا لازم ينرفض، أحد: ${REJECT_REASONS.join('، ')} — وإلا null.\n` +
  '- reason: سبب قصير بالعربي.\n' +
  'أرجع JSON فقط: {"verdicts":[{"id":"...","directness":0,"familiarity":0,"memorability":0,"truthfulness":0,' +
  '"simplicity":0,"hallucinationRisk":0,"twoSecondTest":true,"coversFact":true,"specific":true,"obvious":true,"forcedInterest":false,' +
  '"phoneticClear":true,"rejectReason":null,"reason":"..."}]} — حكم واحد لكل id.';

export async function verifyBridges(
  concept: ExtractedConcept,
  memoryTarget: string,
  candidates: BridgeCandidate[],
  opts: { userId: string; factType: FactType }
): Promise<Map<string, BridgeVerdict>> {
  const verdicts = new Map<string, BridgeVerdict>();
  if (candidates.length === 0) return verdicts;

  const result = await routedComplete({
    tier: 'judge',
    agent: 'connection_critic',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0,
    maxTokens: 6144,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          fact: { atomLabel: concept.atomLabel, title: concept.title, summary: concept.summary, factType: opts.factType },
          memoryTarget,
          candidates: candidates.map((c) => ({
            id: c.id,
            type: c.connectionType,
            anchor: c.anchor,
            worldRef: c.worldRef,
            bridgeLine: c.bridgeLine,
            whyOneLiner: c.whyOneLiner,
            evidence: c.evidence,
            fromInterest: c.fromInterest === true,
            verifiedFact: c.interestFactId !== undefined,
            ...(c.phonetic ? { soundsLike: c.phonetic.soundsLike, matchedSound: c.phonetic.matchedSound } : {})
          }))
        })
      }
    ]
  });

  // Mock/offline: judge nothing rather than approve anything unjudged.
  if (result.isMock) return verdicts;

  const parsed = parseJsonResponse<{ verdicts?: unknown[] }>(result.text);
  const known = new Set(candidates.map((c) => c.id));
  for (const raw of parsed.verdicts ?? []) {
    const v = normalizeVerdict(raw);
    if (v && known.has(v.id)) verdicts.set(v.id, v);
  }
  return verdicts;
}

export function normalizeVerdict(raw: unknown): BridgeVerdict | null {
  const v = raw as Record<string, unknown> | null;
  if (!v || typeof v.id !== 'string') return null;
  // Missing scores count as the worst value — the judge has to vouch, not abstain.
  const score = (x: unknown, worst: number) => {
    const n = Number(x);
    return x === null || x === undefined || !Number.isFinite(n) ? worst : Math.max(0, Math.min(10, n));
  };
  const reason = String(v.rejectReason ?? '').toLowerCase() as RejectReason;
  return {
    id: v.id,
    directness: score(v.directness, 0),
    familiarity: score(v.familiarity, 0),
    memorability: score(v.memorability, 0),
    truthfulness: score(v.truthfulness, 0),
    simplicity: score(v.simplicity, 0),
    hallucinationRisk: score(v.hallucinationRisk, 10),
    twoSecondTest: v.twoSecondTest === true,
    coversFact: v.coversFact === true,
    specific: v.specific === true,
    obvious: v.obvious === true,
    // Only a clear "no" clears a candidate of being forced or of an unclear sound match.
    forcedInterest: v.forcedInterest !== false,
    phoneticClear: v.phoneticClear === true,
    rejectReason: REJECT_REASONS.includes(reason) ? reason : null,
    reason: typeof v.reason === 'string' ? v.reason : ''
  };
}
