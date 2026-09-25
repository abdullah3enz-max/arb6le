import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { BridgeCandidate, BridgeVerdict, ExtractedConcept, Forcedness } from '@/lib/ai/types';

/*
 * VERIFICATION — strict on purpose, and independent: a separate call that judges every candidate
 * at once (so it compares them against each other), at temperature 0, and never sees the
 * student's interests — personalization can't pressure a verdict it isn't told about.
 */

const SYSTEM_PROMPT =
  '[AGENT:bridge_verifier] أنت مدقق مستقل وصارم لجسور ذاكرة. ما تولّد روابط — تحكم عليها فقط. ' +
  'لكل مرشح أجب بدقة:\n' +
  '1) factTrue: هل evidence صحيحة حرفيًا؟ دقّق الأرقام والأعداد والأسماء والتواريخ بالضبط ' +
  '(عدد أعضاء، عدد جوائز، رقم قميص، عدد شخصيات أو مواسم...). إذا الرقم غلط أو مو متأكد → false. ' +
  'لا تجامل.\n' +
  '2) linkTrue: هل الرابط تطابق حقيقي مع العنصر (نفس الرقم فعلًا، أو مقطع كامل ينطق مثله فعلًا، ' +
  'أو نفس عدد المراحل وترتيبها، أو نفس المعنى)؟ حرف أو حرفين مشتركين = false. "اسم مشهور = صفة ' +
  'عامة" (فلان = الدقة/القوة/العمق) = false.\n' +
  '3) forcedness: NATURAL (أي شخص يشوف الرابط يقول "صح!")، WEAK (صحيح بس يحتاج تبرير)، ' +
  'FORCED (مصطنع أو محشور).\n' +
  '4) relationDistance: عدد الخطوات الذهنية فعليًا بين العنصر والمرجع (1 = مباشر).\n' +
  '5) coversMemoryTarget: هل الرابط يساعد على تذكر الجزء الصعب (memoryTarget) نفسه، مو كلمة جانبية؟\n' +
  '6) scores من 0 إلى 100: connection (قوة التطابق)، simplicity (يُفهم خلال ثانيتين)، memorability ' +
  '(مميز ويُتخيل ويساعد على الاسترجاع لاحقًا)، evidence (قابلية التحقق المستقل).\n' +
  '7) reason: سبب قصير بالعربي.\n' +
  'أرجع JSON فقط: {"verdicts":[{"id","factTrue":true,"linkTrue":true,"forcedness":"NATURAL|WEAK|FORCED",' +
  '"relationDistance":1,"coversMemoryTarget":true,"scores":{"connection":0,"simplicity":0,"memorability":0,' +
  '"evidence":0},"reason":"..."}]} — حكم واحد لكل id.';

const FORCEDNESS: Forcedness[] = ['NATURAL', 'WEAK', 'FORCED'];

export async function verifyBridges(
  concept: ExtractedConcept,
  memoryTarget: string,
  candidates: BridgeCandidate[],
  opts: { userId: string }
): Promise<Map<string, BridgeVerdict>> {
  const verdicts = new Map<string, BridgeVerdict>();
  if (candidates.length === 0) return verdicts;

  const result = await routedComplete({
    tier: 'strong',
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
          fact: { atomLabel: concept.atomLabel, title: concept.title, summary: concept.summary },
          memoryTarget,
          candidates: candidates.map((c) => ({
            id: c.id,
            anchor: c.anchor,
            connectionType: c.connectionType,
            worldRef: c.worldRef,
            bridgeLine: c.bridgeLine,
            whyOneLiner: c.whyOneLiner,
            evidence: c.evidence
          }))
        })
      }
    ]
  });

  // Mock/offline: verify nothing rather than approve anything unverified.
  if (result.isMock) return verdicts;

  const parsed = parseJsonResponse<{ verdicts?: unknown[] }>(result.text);
  const known = new Set(candidates.map((c) => c.id));
  for (const raw of parsed.verdicts ?? []) {
    const v = normalizeVerdict(raw);
    if (v && known.has(v.id)) verdicts.set(v.id, v);
  }
  return verdicts;
}

function normalizeVerdict(raw: unknown): BridgeVerdict | null {
  const v = raw as Record<string, unknown> | null;
  if (!v || typeof v.id !== 'string') return null;
  const s = (v.scores ?? {}) as Record<string, unknown>;
  const score = (x: unknown) => (Number.isFinite(Number(x)) ? Math.max(0, Math.min(100, Number(x))) : 0);
  const forcedness = String(v.forcedness ?? '').toUpperCase() as Forcedness;
  const distance = Math.round(Number(v.relationDistance));
  return {
    id: v.id,
    // Anything not explicitly true is treated as false — the verifier has to vouch, not abstain.
    factTrue: v.factTrue === true,
    linkTrue: v.linkTrue === true,
    forcedness: FORCEDNESS.includes(forcedness) ? forcedness : 'FORCED',
    relationDistance: Number.isFinite(distance) && distance > 0 ? distance : 9,
    coversMemoryTarget: v.coversMemoryTarget === true,
    scores: {
      connection: score(s.connection),
      simplicity: score(s.simplicity),
      memorability: score(s.memorability),
      evidence: score(s.evidence)
    },
    reason: typeof v.reason === 'string' ? v.reason : ''
  };
}
