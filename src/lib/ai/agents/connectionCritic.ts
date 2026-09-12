import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { ConnectionCandidate, CriticVerdict, ExtractedConcept } from '@/lib/ai/types';

const CRITIC_QUESTIONS = [
  'هل المعلومة الأكاديمية صحيحة؟',
  'هل معلومة العالم الخارجي صحيحة؟',
  'هل العلاقة بين الاثنين حقيقية (وليست تشابه أسماء فقط)؟',
  'هل العلاقة مفيدة للذاكرة (نفس السلوك/التسلسل/الآلية، لا تشبيه سطحي)؟',
  'هل الرابط مباشر بدون قفزات منطقية؟',
  'هل يوجد أي Hallucination؟',
  'هل يمكن للمستخدم الاعتراض المنطقي على هذا الربط؟',
  'هل يوجد رابط أفضل من نفس العالم أو عالم آخر؟'
];

/**
 * STEP: Connection Critic — an independent LLM call from a different angle than the
 * Connection Finder, deliberately not reusing that call's reasoning, so it can actually
 * catch the Finder's mistakes instead of rubber-stamping them.
 */
export async function critiqueConnection(
  candidate: ConnectionCandidate,
  concept: ExtractedConcept,
  opts: { userId: string }
): Promise<CriticVerdict> {
  const result = await routedComplete({
    tier: 'strong',
    agent: 'connection_critic',
    userId: opts.userId,
    responseFormat: 'json',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:connection_critic] أنت ناقد صارم مستقل، وظيفتك رفض الروابط الضعيفة أو ' +
          'المُخترعة. أجب على الأسئلة الثمانية بالترتيب بصدق (لا تتحيز لقبول الرابط). ' +
          `الأسئلة:\n${CRITIC_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n` +
          'إذا كانت إجابة أي سؤال من 2, 3, 6 "لا" → REJECT فورًا. إذا كانت إجابة السؤال 4 أو 5 ' +
          '"لا" بشكل واضح → REJECT. أرجع JSON فقط: {"verdict":"APPROVE|REJECT",' +
          '"failedQuestion": رقم أو null, "reason": "شرح قصير بالعربي"}'
      },
      {
        role: 'user',
        content: JSON.stringify({
          concept: { title: concept.title, summary: concept.summary },
          connection: {
            worldRef: candidate.worldRef,
            headline: candidate.headline,
            relationExplain: candidate.relationExplain,
            claimType: candidate.claimType,
            sources: candidate.sources
          }
        })
      }
    ]
  });

  if (result.isMock) {
    return { verdict: 'REJECT', failedQuestion: 6, reason: 'Mock provider — no real verification performed.' };
  }

  return parseJsonResponse<CriticVerdict>(result.text);
}
