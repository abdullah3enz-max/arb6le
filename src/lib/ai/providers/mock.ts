import type { LlmCallOptions, LlmCallResult, LlmProvider } from './types';

/**
 * Offline provider used when no ANTHROPIC_API_KEY is configured (dev/demo only).
 * It returns clearly-labeled (`isMock: true`) canned JSON so the pipeline UI and
 * data flow can be exercised end-to-end without real model calls or a real bill.
 * Agents MUST check `isMock` and never surface mock output to a user as a verified fact —
 * see MockGuard in pipeline.ts, which forces claimType downgrades and source stripping
 * on any mock-derived connection.
 *
 * Each agent tags its system prompt with "[AGENT:<name>]" so this provider can return a
 * shape-correct (not fact-correct) stub for that step.
 */
export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  async complete(options: LlmCallOptions): Promise<LlmCallResult> {
    const system = options.messages.find((m) => m.role === 'system')?.content ?? '';
    const tagMatch = system.match(/\[AGENT:(\w+)\]/);
    const agent = tagMatch?.[1] ?? 'unknown';
    const text = JSON.stringify(mockPayloadFor(agent));

    return {
      text,
      model: 'mock-offline',
      inputTokens: estimateTokens(options.messages),
      outputTokens: estimateTokens([{ content: text }]),
      isMock: true
    };
  }
}

function estimateTokens(messages: { content: string }[]) {
  return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
}

function mockPayloadFor(agent: string): unknown {
  switch (agent) {
    case 'concept_extractor':
      return {
        concepts: [
          {
            title: '[MOCK] Concept placeholder',
            summary: 'شغّل ANTHROPIC_API_KEY لرؤية استخراج حقيقي للمفاهيم من السلايدات.',
            atomLabel: '',
            atomEmoji: '🧠',
            importance: 50,
            conceptType: 'DEFINITION'
          }
        ]
      };
    case 'connection_finder':
      return { candidates: [] }; // mock never invents a bridge — respects Fact Grounding
    case 'fact_checker':
      return { verified: false, reason: 'MOCK_PROVIDER_NO_VERIFICATION_PERFORMED' };
    case 'connection_critic':
      return {
        verdict: 'REJECT',
        failedCheck: 'hallucination',
        reason: 'Mock provider cannot verify hallucination-freedom — auto-rejected by policy.'
      };
    default:
      return { mock: true, agent };
  }
}
