import { routedComplete, parseJsonResponse } from '@/lib/ai/router';
import type { ConceptRelation, ExtractedConcept } from '@/lib/ai/types';

/** STEP 5 (relations between Concepts) + STEP 8 (sequences/causes/effects). */
export async function mapConceptRelations(
  concepts: ExtractedConcept[],
  opts: { userId: string; cacheKeyPrefix: string }
): Promise<ConceptRelation[]> {
  if (concepts.length < 2) return [];

  const result = await routedComplete({
    tier: 'fast',
    agent: 'knowledge_mapper',
    userId: opts.userId,
    cacheKey: `${opts.cacheKeyPrefix}:relations`,
    responseFormat: 'json',
    maxTokens: 4096,
    messages: [
      {
        role: 'system',
        content:
          '[AGENT:knowledge_mapper] حدد العلاقات الحقيقية بين هذه المفاهيم فقط (لا تخترع علاقة ' +
          'غير موجودة في النص). أرجع JSON: {"relations": [{"fromTitle","toTitle",' +
          '"relation": "cause_effect|sequence|similar_term|contrast"}]}'
      },
      { role: 'user', content: JSON.stringify(concepts.map((c) => ({ title: c.title, summary: c.summary }))) }
    ]
  });

  if (result.isMock) return [];

  const parsed = parseJsonResponse<{ relations: ConceptRelation[] }>(result.text);
  return parsed.relations ?? [];
}
