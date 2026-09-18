import type { LlmCallOptions, LlmCallResult, LlmProvider } from './types';

/**
 * Generic adapter for any provider that speaks the OpenAI Chat Completions wire format —
 * OpenRouter, local runtimes (Ollama/LM Studio), or any "free model" aggregator that exposes
 * an OpenAI-compatible `/chat/completions` endpoint. This is what makes the router
 * provider-agnostic (item: "flexible, works with many models, no vendor lock-in") instead of
 * hardcoded to Anthropic.
 *
 * Configure via OPENAI_COMPATIBLE_BASE_URL + OPENAI_COMPATIBLE_API_KEY + model name env vars.
 * No base URL is invented here — an unconfigured base URL is a hard error, never a guess.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(params: { baseUrl: string; apiKey: string; model: string; name?: string }) {
    this.baseUrl = params.baseUrl.replace(/\/+$/, '');
    this.apiKey = params.apiKey;
    this.model = params.model;
    this.name = params.name ?? 'openai-compatible';
  }

  async complete(options: LlmCallOptions): Promise<LlmCallResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2048
        // Deliberately NOT sending response_format:{type:"json_object"} — on some free models
        // routed through OpenRouter, strict JSON-mode enforcement appears to zero out `content`
        // entirely when the model's raw output doesn't cleanly conform (rather than passing it
        // through), which is worse than the noisy-but-present text our own parseJsonResponse
        // extraction (router.ts) is built to handle. The system prompts already ask for JSON.
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${this.name} API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    // Some reasoning models occasionally leave `content` empty and put everything in
    // `reasoning` instead (observed on real large-document runs). Fall back to it rather than
    // handing the caller an empty string that can never contain the JSON it asked for.
    const text: string = choice?.message?.content || choice?.message?.reasoning || '';

    return {
      text,
      model: data.model ?? this.model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      isMock: false
    };
  }
}
