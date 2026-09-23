import { AnthropicProvider } from './providers/anthropic';
import { OpenAiCompatibleProvider } from './providers/openaiCompatible';
import { MockProvider } from './providers/mock';
import type { LlmCallOptions, LlmCallResult, LlmProvider } from './providers/types';
import { db } from '@/lib/db';

export type ModelTier = 'fast' | 'strong';

const cache = new Map<string, LlmCallResult>();

interface ProviderConfig {
  provider: 'anthropic' | 'openai_compatible' | 'mock';
  model: string;
}

/**
 * Pure resolution of what buildProvider() would construct for a tier, with no side effects and
 * no throwing — shared by buildProvider (real calls) and describeConfiguredModels (admin
 * dashboard) so the two can never drift apart. Whatever the dashboard reports as "current model"
 * is exactly what the next real call will use, not a best guess kept in sync by hand.
 */
function resolveProviderConfig(tier: ModelTier): ProviderConfig {
  const requested = process.env.LLM_PROVIDER; // 'anthropic' | 'openai_compatible' | unset (auto)

  const wantsAnthropic = requested === 'anthropic' || (!requested && process.env.ANTHROPIC_API_KEY);
  if (wantsAnthropic && process.env.ANTHROPIC_API_KEY) {
    const model =
      tier === 'fast'
        ? process.env.ANTHROPIC_MODEL_FAST ?? 'claude-haiku-4-5-20251001'
        : process.env.ANTHROPIC_MODEL_STRONG ?? 'claude-sonnet-5';
    return { provider: 'anthropic', model };
  }

  const wantsOpenAiCompatible =
    requested === 'openai_compatible' || (!requested && process.env.OPENAI_COMPATIBLE_API_KEY);
  if (wantsOpenAiCompatible) {
    const model =
      (tier === 'fast' ? process.env.OPENAI_COMPATIBLE_MODEL_FAST : process.env.OPENAI_COMPATIBLE_MODEL_STRONG) ??
      process.env.OPENAI_COMPATIBLE_MODEL ??
      '(OPENAI_COMPATIBLE_MODEL غير معرّف)';
    return { provider: 'openai_compatible', model };
  }

  return { provider: 'mock', model: 'mock-offline' };
}

/**
 * Provider-agnostic by design: LLM_PROVIDER picks the backend explicitly, or — if unset —
 * the first one with credentials configured wins. No vendor is hardcoded as "the" provider;
 * adding a new one is a new class in providers/ plus a branch here, never a rewrite of the
 * agents (they only ever call routedComplete).
 */
function buildProvider(tier: ModelTier): LlmProvider {
  const config = resolveProviderConfig(tier);

  if (config.provider === 'anthropic') return new AnthropicProvider(config.model);

  if (config.provider === 'openai_compatible') {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
    const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        'LLM_PROVIDER=openai_compatible requires OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY.'
      );
    }
    if (!process.env.OPENAI_COMPATIBLE_MODEL_FAST && !process.env.OPENAI_COMPATIBLE_MODEL_STRONG && !process.env.OPENAI_COMPATIBLE_MODEL) {
      throw new Error(
        'Set OPENAI_COMPATIBLE_MODEL (or _FAST/_STRONG) to the exact model name your provider expects.'
      );
    }
    return new OpenAiCompatibleProvider({
      baseUrl,
      apiKey,
      model: config.model,
      name: process.env.OPENAI_COMPATIBLE_NAME,
      extraBody: parseExtraBody(process.env.OPENAI_COMPATIBLE_EXTRA_BODY)
    });
  }

  return new MockProvider();
}

/**
 * OPENAI_COMPATIBLE_EXTRA_BODY: an optional raw JSON object string merged into every request to
 * an OpenAI-compatible endpoint — e.g. {"reasoning":{"effort":"low"}} to throttle down a
 * reasoning-capable model like openai/gpt-oss-120b via OpenRouter, which otherwise spends real
 * time (and, on a paid plan, real money) on hidden chain-of-thought before ever writing the
 * answer. A malformed value is a warning, not a crash — every LLM call must not go down because
 * of one bad env var.
 */
function parseExtraBody(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('OPENAI_COMPATIBLE_EXTRA_BODY is not valid JSON — ignoring it:', raw);
    return undefined;
  }
}

/**
 * What the admin AI Usage dashboard shows as "the model we use now" — safe to call even with a
 * broken/unconfigured openai_compatible setup (unlike buildProvider, which throws), since this
 * is describing config, not making a call.
 */
export function describeConfiguredModels(): { provider: ProviderConfig['provider']; fast: string; strong: string } {
  return {
    provider: resolveProviderConfig('fast').provider, // one provider serves both tiers
    fast: resolveProviderConfig('fast').model,
    strong: resolveProviderConfig('strong').model
  };
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
 *
 * Records an AiGeneration row on every path — including a cache hit (real cacheHit:true, zero
 * cost since no API call happened) and a provider failure (success:false) — not just the happy
 * path. The admin AI Usage Center's cache-hit-rate and failed-generation KPIs are only honest if
 * every outcome is actually recorded, not just successful paid calls.
 */
export async function routedComplete(args: RoutedCallArgs): Promise<LlmCallResult> {
  const cacheKey = args.cacheKey ? `${args.agent}:${args.tier}:${args.cacheKey}` : undefined;
  const startedAt = Date.now();

  if (cacheKey && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    await recordGeneration(args, { result: cached, latencyMs: Date.now() - startedAt, cacheHit: true, success: true });
    return cached;
  }

  const provider = buildProvider(args.tier);

  try {
    const result = await provider.complete({
      messages: args.messages,
      responseFormat: args.responseFormat,
      temperature: args.temperature,
      maxTokens: args.maxTokens
    });
    const latencyMs = Date.now() - startedAt;

    if (cacheKey) cache.set(cacheKey, result);
    await recordGeneration(args, {
      result,
      latencyMs,
      cacheHit: false,
      success: true,
      costCents:
        result.costUsd !== undefined
          ? result.costUsd * 100
          : estimateCostCents(provider.name, args.tier, result.inputTokens, result.outputTokens)
    });

    return result;
  } catch (error) {
    await recordGeneration(args, { result: null, latencyMs: Date.now() - startedAt, cacheHit: false, success: false });
    throw error;
  }
}

async function recordGeneration(
  args: RoutedCallArgs,
  outcome: { result: LlmCallResult | null; latencyMs: number; cacheHit: boolean; success: boolean; costCents?: number }
) {
  if (!args.userId) return;
  await db.aiGeneration.create({
    data: {
      userId: args.userId,
      agent: args.agent,
      model: outcome.result?.model ?? 'unknown',
      inputTokens: outcome.result?.inputTokens ?? 0,
      outputTokens: outcome.result?.outputTokens ?? 0,
      costCents: outcome.costCents ?? 0,
      latencyMs: outcome.latencyMs,
      cacheHit: outcome.cacheHit,
      success: outcome.success
    }
  });
}

/**
 * Fallback only — used when the provider didn't report a real cost (result.costUsd is
 * undefined), e.g. Anthropic (no per-call cost in its API response) or an OpenAI-compatible
 * backend that doesn't support OpenRouter's usage-accounting extension. OpenRouter calls
 * normally skip this entirely: openaiCompatible.ts reads the actual dollar cost straight off
 * `usage.cost` and routedComplete uses that instead, so real spend on a paid model is never
 * silently logged as free.
 */
function estimateCostCents(providerName: string, tier: ModelTier, inputTokens: number, outputTokens: number) {
  if (providerName !== 'anthropic') return 0;
  const rates = tier === 'fast' ? { in: 0.025, out: 0.125 } : { in: 0.3, out: 1.5 };
  return (inputTokens / 1000) * rates.in + (outputTokens / 1000) * rates.out;
}

/**
 * Some free/reasoning models (via OpenRouter) leak chain-of-thought into the `content` field
 * instead of keeping it in the separate `reasoning` field, and sometimes wrap the real object
 * in stray extra braces (observed: `{ { "candidates": [...] } }` — an unmatched outer `{` with
 * only the inner object actually closed). A naive "first `{` to last `}`" slice breaks on that.
 * Instead, scan for every candidate start and track bracket depth (honoring quoted strings and
 * escapes) to find one that is actually balanced, and parse that. Still throws if nothing in
 * the text is valid JSON — this must never silently invent a shape.
 */
export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to extraction below.
  }

  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== '{' && cleaned[i] !== '[') continue;

    const end = findBalancedEnd(cleaned, i);
    if (end === -1) continue;

    try {
      return JSON.parse(cleaned.slice(i, end + 1)) as T;
    } catch {
      // Not this one — keep scanning for the next candidate start.
    }
  }

  throw new Error(`No valid JSON object/array found in model response: ${cleaned.slice(0, 300)}`);
}

/** Returns the index of the character that closes the bracket opened at `start`, or -1. */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
