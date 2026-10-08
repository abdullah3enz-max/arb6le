import { routedComplete, parseJsonResponse } from '@/lib/ai/router';

/*
 * LAST LINE BEFORE DISPLAY — an adversarial fact check of the few associations that would
 * actually be shown. Separate from the association judge on purpose: the judge scores many
 * candidates at once and asks "is this a good association?"; this asks only "is this claim
 * literally true?" and is told to look for the reason it is false. It runs on the judge tier
 * (ideally a different model from the generator). Only an explicit TRUE survives.
 */

export type ClaimVerdict = 'TRUE' | 'FALSE' | 'UNSURE';

export interface Claim {
  id: string;
  /** The association line plus the fact it rests on. */
  statement: string;
}

const SYSTEM_PROMPT =
  '[AGENT:claim_checker] أنت مدقق حقائق متشكك. لكل ادعاء، حاول تلقى سبب يخليه غلط: رقم مختلف، ' +
  'اسم غلط، حدث ما صار، شخصية ما قالت هالشي، قياس تقريبي بعيد عن الرقم المذكور، أو دليل يناقض الرابط نفسه.\n' +
  '- TRUE: فقط إذا أنت متأكد إنه صحيح حرفيًا (الأرقام والأسماء بالضبط).\n' +
  '- FALSE: إذا فيه خطأ، أو الرقم تقريبي وبعيد، أو الدليل ما يدعم الرابط.\n' +
  '- UNSURE: إذا ما تعرف بيقين.\n' +
  'أرجع JSON فقط: {"results":[{"id":"...","verdict":"TRUE|FALSE|UNSURE","note":"سبب قصير"}]}';

export async function checkClaims(
  claims: Claim[],
  opts: { userId: string }
): Promise<Map<string, { verdict: ClaimVerdict; note: string }>> {
  const out = new Map<string, { verdict: ClaimVerdict; note: string }>();
  if (claims.length === 0) return out;

  const result = await routedComplete({
    tier: 'judge',
    agent: 'claim_checker',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0,
    maxTokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(claims) }
    ]
  });
  if (result.isMock) return out;

  const known = new Set(claims.map((c) => c.id));
  for (const r of parseJsonResponse<{ results?: { id?: unknown; verdict?: unknown; note?: unknown }[] }>(result.text).results ?? []) {
    if (typeof r.id !== 'string' || !known.has(r.id)) continue;
    const v = String(r.verdict ?? '').toUpperCase();
    out.set(r.id, {
      verdict: v === 'TRUE' || v === 'FALSE' ? v : 'UNSURE',
      note: typeof r.note === 'string' ? r.note : ''
    });
  }
  return out;
}
