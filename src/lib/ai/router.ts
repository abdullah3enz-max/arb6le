import { AnthropicProvider } from './providers/anthropic';
import { MockProvider } from './providers/mock';
import type { LlmCallOptions, LlmCallResult, LlmProvider } from './providers/types';
import { db } from '@/lib/db';

export type ModelTier = 'fast' | 'strong';

const cache = new Map<string, LlmCallResult>();

function buildProvider(tier: ModelTier): LlmProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new MockProvider();

  const model =
    tier === 'fast'
      ? process.env.ANTHROPIC_MODEL_FAST ?? 'claude-haiku-4-5-20251001'
      : process.env.ANTHROPIC_MODEL_STRONG ?? 'claude-sonnet-5';

  return new AnthropicProvider(model);
}

interface RoutedCallArgs extends LlmCallOptions {
  tier: ModelTier;
  agent: string;
  /** Stable key (e.g. documentId:pageHash) to skip re-running unchanged input. */
  cacheKey?: string;
  userId?: string;
}

/**
 * Single entry point every agent must call — this is what makes "no re-analysis of an
 * unchanged page" (item 43) and per-agent AiGeneration accounting (item 27/39) hold true
 * across the whole pipeline instead of being reimplemented ad hoc in each agent.
 */
export async function routedComplete(args: RoutedCallArgs): Promise<LlmCallResult> {
  const cacheKey = args.cacheKey ? `${args.agent}:${args.tier}:${args.cacheKey}` : undefined;
  if (cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const provider = buildProvider(args.tier);
  const startedAt = Date.now();
  const result = await provider.complete({
    messages: args.messages,
    responseFormat: args.responseFormat,
    temperature: args.temperature,
    maxTokens: args.maxTokens
  });
  const latencyMs = Date.now() - startedAt;

  if (cacheKey) cache.set(cacheKey, result);

  if (args.userId) {
    await db.aiGeneration.create({
      data: {
        userId: args.userId,
        agent: args.agent,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costCents: estimateCostCents(args.tier, result.inputTokens, result.outputTokens),
        latencyMs,
        cacheHit: false
      }
    });
  }

  return result;
}

function estimateCostCents(tier: ModelTier, inputTokens: number, outputTokens: number) {
  // Rough placeholder rates (cents per 1K tokens) — replace with live pricing table.
  const rates = tier === 'fast' ? { in: 0.025, out: 0.125 } : { in: 0.3, out: 1.5 };
  return (inputTokens / 1000) * rates.in + (outputTokens / 1000) * rates.out;
}

export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  return JSON.parse(cleaned) as T;
}
