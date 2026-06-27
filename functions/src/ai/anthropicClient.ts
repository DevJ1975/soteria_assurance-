/**
 * Anthropic Claude client wrapper.
 *
 * SOTERIA RULE 7 — the Claude client is built from the Secret-Manager-backed
 * `ANTHROPIC_API_KEY` (never an env literal), every call is bounded by a 30s
 * timeout, and failures degrade gracefully into a typed error result rather
 * than throwing, so the calling function can decide how to respond.
 *
 * The model id is pinned to `claude-sonnet-4-6` per MONOREPO CONTRACT /
 * DESIGN_DOC §10.
 *
 * @packageDocumentation
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '../common/secrets';

/** The single Claude model used across all Soteria AI features. */
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

/** Hard timeout for any single Claude call (multi-agent-guide §8). */
export const CLAUDE_TIMEOUT_MS = 30_000;

/** Default response budget; individual callers may lower this. */
export const DEFAULT_MAX_TOKENS = 1024;

/** Image media types Claude accepts for base64 multimodal blocks. */
export type ClaudeImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/** A multimodal content block accepted by {@link callClaude}. */
export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: ClaudeImageMediaType; data: string };
    };

/** Options for a single Claude invocation. */
export interface CallClaudeOptions {
  maxTokens?: number;
  /** Override the default 30s timeout (still capped by the SDK request). */
  timeoutMs?: number;
}

/** Discriminated result of a Claude call — never throws on API failure. */
export type CallClaudeResult =
  | {
      ok: true;
      text: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
    }
  | {
      ok: false;
      /** Human-readable, safe-to-log error category. */
      error: string;
    };

/**
 * Builds an Anthropic client from the Secret-Manager-backed API key.
 *
 * Must be called inside a function whose `secrets` array includes
 * `ANTHROPIC_API_KEY`, otherwise `.value()` returns an empty string at runtime.
 */
export function buildAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: ANTHROPIC_API_KEY.value(),
    timeout: CLAUDE_TIMEOUT_MS,
    maxRetries: 1,
  });
}

/**
 * Calls Claude with a system prompt and a single user turn.
 *
 * @param system - The ARIA persona system prompt (from `@soteria/core`).
 * @param prompt - The user-turn content: a string or multimodal blocks.
 * @param opts   - Optional token / timeout overrides.
 * @returns A typed success or graceful-error result.
 */
export async function callClaude(
  system: string,
  prompt: string | ClaudeContentBlock[],
  opts: CallClaudeOptions = {},
): Promise<CallClaudeResult> {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? CLAUDE_TIMEOUT_MS;

  const content: ClaudeContentBlock[] =
    typeof prompt === 'string' ? [{ type: 'text', text: prompt }] : prompt;

  try {
    const client = buildAnthropicClient();
    const message = await client.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      },
      { timeout: timeoutMs },
    );

    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return {
      ok: true,
      text,
      model: message.model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch (err) {
    // Graceful degradation: surface a typed, non-throwing error so the caller
    // can return a friendly message and still log the attempt.
    const error = err instanceof Error ? err.message : 'Unknown AI error';
    return { ok: false, error };
  }
}
