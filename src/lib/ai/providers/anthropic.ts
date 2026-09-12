import type { LlmCallOptions, LlmCallResult, LlmProvider } from './types';

/**
 * Real Anthropic-backed provider. Requires ANTHROPIC_API_KEY.
 * Uses the plain Messages API over fetch to avoid an extra SDK dependency in this scaffold —
 * swap for @anthropic-ai/sdk if preferred, the LlmProvider interface stays the same either way.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private apiKey: string;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY missing — cannot construct AnthropicProvider.');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(options: LlmCallOptions): Promise<LlmCallResult> {
    const system = options.messages.find((m) => m.role === 'system')?.content;
    const rest = options.messages.filter((m) => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.3
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const text = data.content?.map((c: { text?: string }) => c.text ?? '').join('') ?? '';

    return {
      text,
      model: this.model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      isMock: false
    };
  }
}
