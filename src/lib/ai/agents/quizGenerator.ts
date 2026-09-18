import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { ExtractedConcept } from '@/lib/ai/types';

export interface GeneratedQuizQuestion {
  conceptTitle: string;
  kind: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SCENARIO' | 'RECALL';
  prompt: string;
  choices?: string[];
  correctAnswer: string;
  explanation: string;
}

/** STEP 12: quiz generation directly from verified Concepts — never from the world-connections. */
export async function generateQuiz(
  concepts: ExtractedConcept[],
  opts: { userId: string; cacheKeyPrefix: string }
): Promise<GeneratedQuizQuestion[]> {
  if (concepts.length === 0) return [];

  const result = await routedComplete({
    tier: 'fast',
    agent: 'quiz_generator',
    userId: opts.userId,
    cacheKey: `${opts.cacheKeyPrefix}:quiz`,
    responseFormat: 'json',
    maxTokens: 4096,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:quiz_generator] أنشئ أسئلة متنوعة (اختيار متعدد، صح/خطأ، تعبئة فراغ، سيناريو ' +
          'عملي إذا كان المجال مناسبًا، واسترجاع مباشر) من هذه المفاهيم الأكاديمية فقط — لا تربطها ' +
          'بأي عالم خارجي هنا. أرجع JSON: {"questions": [{"conceptTitle","kind":' +
          '"MULTIPLE_CHOICE|TRUE_FALSE|FILL_BLANK|SCENARIO|RECALL","prompt","choices"?,' +
          '"correctAnswer","explanation"}]}. مهم: correctAnswer دائمًا نص (string) حتى لأسئلة ' +
          'TRUE_FALSE — استخدم "صحيح" أو "خطأ" كنص، ممنوع ترجع true/false كـ boolean.'
      },
      { role: 'user', content: JSON.stringify(concepts.map((c) => ({ title: c.title, summary: c.summary, type: c.conceptType }))) }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ questions: GeneratedQuizQuestion[] }>(result.text);
  return parsed.questions ?? [];
}
