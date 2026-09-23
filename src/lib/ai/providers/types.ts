// Provider interfaces. Every agent depends on these, never on a specific vendor SDK,
// so swapping Anthropic/OpenAI or wiring a real search API touches one file.

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  messages: LlmMessage[];
  /** Force valid-JSON output matched against a shape the caller already knows. */
  responseFormat?: 'json' | 'text';
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCallResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** True only for the offline mock provider — callers must never present this as fact. */
  isMock: boolean;
  /**
   * Actual USD cost of this call, when the provider reports one (e.g. OpenRouter's per-request
   * usage accounting). Undefined — never 0 — when the provider doesn't report it, so the router
   * can tell "really free" apart from "unknown" and fall back to an estimate only in the latter
   * case.
   */
  costUsd?: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(options: LlmCallOptions): Promise<LlmCallResult>;
}

export type SourceType = 'KNOWLEDGE_BASE' | 'LIVE_SEARCH' | 'USER_PROVIDED';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface SearchProvider {
  readonly name: string;
  readonly isLive: boolean; // false only for the "unconfigured" no-op provider
  search(query: string): Promise<SearchResultItem[]>;
}

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}
