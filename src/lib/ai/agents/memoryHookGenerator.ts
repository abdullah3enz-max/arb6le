import { routedComplete } from '@/lib/ai/router';
import type { ConnectionCandidate, ExtractedConcept } from '@/lib/ai/types';

/**
 * Runs only after the Connection Critic approves — polishes the "💡 احفظها كذا" line into one
 * crisp, memorable sentence. Deliberately separate from Connection Finder so the creative
 * writing pass never happens before the connection is verified.
 */
export async function generateMemoryHook(
  candidate: ConnectionCandidate,
  concept: ExtractedConcept,
  opts: { userId: string }
): Promise<string> {
  const result = await routedComplete({
    tier: 'fast',
    agent: 'memory_hook_generator',
    userId: opts.userId,
    responseFormat: 'text',
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:memory_hook_generator] اكتب جملة واحدة قصيرة بالعربي تساعد الطالب يتذكر ' +
          'المفهوم عبر الربط المعتمد. لا تضف أي معلومة جديدة غير موجودة في الربط، فقط صِغه ' +
          'بطريقة أوضح وأقصر للحفظ.'
      },
      {
        role: 'user',
        content: `المفهوم: ${concept.title}\nالربط المعتمد: ${candidate.relationExplain}\nمسودة سابقة: ${candidate.memoryHook}`
      }
    ]
  });

  if (result.isMock) return candidate.memoryHook;
  return result.text.trim();
}
