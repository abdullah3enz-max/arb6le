import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { ConnectionCandidate, CriticVerdict, ExtractedConcept } from '@/lib/ai/types';

const CRITIC_CHECKS = [
  { key: 'factual_accuracy', question: 'هل الحقيقة الخارجية المستخدمة صحيحة فعلًا (مثلًا رقم القميص صحيح تاريخيًا)؟' },
  { key: 'relationship_real', question: 'هل التطابق حقيقي (نفس الرقم/الاسم فعلًا)، وليس تشابه سطحي أو صدفة؟' },
  { key: 'hallucination', question: 'هل يوجد أي تفصيلة مُخترعة (مباراة، حوار، إحصائية، حدث لم يحدث)؟' },
  { key: 'too_slow', question: 'هل يحتاج المستخدم أكثر من ثانيتين ليفهم الرابط من أول قراءة؟' },
  {
    key: 'weak_familiarity',
    question:
      'هل المرجع مشهور بما يكفي إن طالب جامعي سعودي عادي يعرفه (مسلسل/فيلم/أنمي/لاعب/أغنية/كلمة مشهورة جدًا)؟ ' +
      'ارفض فقط لو المرجع غامض أو نادر. مو شرط يكون الطالب سمّاه بنفسه.'
  },
  {
    key: 'forced_by_preference',
    question:
      'اختبار الحقيقة خلف التخصيص (ليس اختبار "هل يحتاج معرفة الاهتمام؟" — كل رابط مخصص يحتاج ذلك بالتعريف، ' +
      'وهذا مطلوب ومقصود، مو عيب): هل الحقيقة المستخدمة عن "worldRef" صحيحة وموثّقة فعلًا (رقم قميص حقيقي، ' +
      'صفة معروفة توثيقيًا، حدث حقيقي)، أم إنها تشابه صوتي/حروف بالصدفة ما كان ليبدو رابطًا منطقيًا حتى ' +
      'لمعجب حقيقي متابع لـ"worldRef" يعرفه جيدًا؟ ارفض فقط النوع الثاني.'
  }
] as const;

/**
 * Connection Critic — an independent LLM call from a different angle than the Connection
 * Finder, deliberately not reusing that call's reasoning, so it can actually catch the
 * Finder's mistakes (or its temptation to write a paragraph instead of a bridge) instead of
 * rubber-stamping them.
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
    // Reasoning-heavy free models can spend most of a small budget on hidden chain-of-thought
    // before ever writing the (short) JSON verdict — give it room to actually finish.
    maxTokens: 2048,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:connection_critic] أنت ناقد صارم مستقل لمحرك ربط ذاكرة (ليس مساعد شرح). ' +
          'وظيفتك رفض أي رابط بطيء، مُخترع، أو غير حقيقي — حتى لو كان "لطيف". تحقق من:\n' +
          CRITIC_CHECKS.map((c, i) => `${i + 1}. [${c.key}] ${c.question}`).join('\n') +
          '\nإذا كانت إجابة factual_accuracy أو relationship_real أو hallucination "لا/نعم فيه مشكلة" ' +
          '→ REJECT فورًا بذاك الـkey. إذا too_slow = "نعم يحتاج وقت" → REJECT بـtoo_slow. إذا ' +
          'weak_familiarity = "ضعيف" → REJECT بـweak_familiarity. إذا فشل اختبار forced_by_preference ' +
          '(الحقيقة نفسها مختلقة أو مجرد تشابه صوتي/حروف سطحي حتى لمعجب حقيقي بـworldRef) → REJECT ' +
          'بـforced_by_preference. ' +
          'تحذير صريح جدًا، لا تخالفه: احتياج الرابط لمعرفة الطالب المسبقة باهتمامه الشخصي (مثلًا لازم ' +
          'يعرف رونالدو عشان يفهم الرابط) ليس سببًا للرفض بذاته إطلاقًا — هذا بالضبط تعريف "التخصيص" ' +
          'اللي المنتج مبني عليه، ومطلوب ومقصود بنسبة 100%. لا ترفض رابطًا فقط لأنه "ما بيفهمه شخص ما ' +
          'يعرف worldRef" — طالما الحقيقة نفسها صحيحة وموثقة وليست تشابه صوتي مصطنع، فهذا رابط ناجح ' +
          'مو مرفوض. يُقبل: رقم بالمعلومة يطابق رقمًا مشهورًا حقيقيًا لمرجع معروف، أو مقطع كامل من ' +
          'المصطلح ينطق فعلًا مثل اسم أو كلمة معروفة، أو قصة مشهورة تمشي بنفس نمط المعلومة. يُرفض: ' +
          'حرف أو حرفين مشتركين فقط، أو اسم مشهور ملصوق بصفة عامة ("فلان = الدقة"). ' +
          'الـbridgeLine يجب يكون سطر واحد ' +
          'قصير جدًا — لو فيه أكثر من جملة قصيرة أو كلمة "تخيل" أو سرد، ارفضه بـtoo_slow. أرجع JSON ' +
          'فقط: {"verdict":"APPROVE|REJECT","failedCheck":"factual_accuracy|relationship_real|' +
          'hallucination|too_slow|weak_familiarity|forced_by_preference"|null,"reason":"شرح قصير بالعربي"}'
      },
      {
        role: 'user',
        content: JSON.stringify({
          fact: { atomLabel: concept.atomLabel, context: concept.title },
          bridge: {
            worldRef: candidate.worldRef,
            bridgeLine: candidate.bridgeLine,
            whyOneLiner: candidate.whyOneLiner,
            associationLevel: candidate.associationLevel,
            claimType: candidate.claimType,
            sources: candidate.sources
          }
        })
      }
    ]
  });

  if (result.isMock) {
    return { verdict: 'REJECT', failedCheck: 'hallucination', reason: 'Mock provider — no real verification performed.' };
  }

  return parseJsonResponse<CriticVerdict>(result.text);
}
