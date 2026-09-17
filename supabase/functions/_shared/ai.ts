/**
 * Shared Claude access for the AI co-pilot functions.
 *
 * Every AI endpoint follows the same shape: authenticate the caller, confirm
 * they are acting inside their own tenant, check the rate limit BEFORE
 * spending anything, call Claude, log the usage, and return a result carrying
 * the mandatory disclaimer. That order matters — checking the limit after the
 * call would let a tenant exceed the cap by exactly the number of concurrent
 * requests it can issue.
 *
 * The prompts and the auditor persona come from @soteria/core, imported as the
 * ESM bundle the Deno runtime can consume. Sharing that build rather than
 * copying the prompt text is deliberate: a duplicated persona drifts from the
 * one the package's tests assert against, silently and without failing
 * anything.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@^0.72.0';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AI_DISCLAIMER } from '../../../packages/core/dist-esm/index.mjs';
import { HttpError, requireCaller, serviceClient, type CallerProfile } from './auth.ts';

/**
 * The model behind every Soteria AI feature.
 *
 * Audit work is reasoning-heavy and the cost of a wrong nonconformity is an
 * auditor's credibility, so this is deliberately not a cheaper tier.
 */
export const CLAUDE_MODEL = 'claude-opus-5';

/** Requests per tenant per rolling hour, enforced from `ai_logs`. */
export const AI_RATE_LIMIT_PER_HOUR = 100;

/** Hard ceiling on any single completion. */
export const DEFAULT_MAX_TOKENS = 4096;

export { AI_DISCLAIMER };

let client: Anthropic | null = null;

/**
 * The Claude client, built from the ANTHROPIC_API_KEY secret.
 *
 * Set it with `supabase secrets set ANTHROPIC_API_KEY=...` for the hosted
 * project, or in `supabase/functions/.env` for local development. It is never
 * read from anywhere the browser can reach.
 */
export function anthropic(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new HttpError(
      503,
      'The AI co-pilot is not configured. ANTHROPIC_API_KEY is not set on this project.',
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/** What every AI endpoint resolves before doing any work. */
export interface AICallContext {
  caller: CallerProfile;
  admin: SupabaseClient;
  tenantId: string;
}

/**
 * Roles granted `ai_copilot` in ROLE_PERMISSIONS
 * (packages/core/src/constants/rbac.ts). Neither `auditee` — the organization
 * being audited — nor `viewer` holds it.
 *
 * Without this check an auditee could invoke `draft-ncr` against their own
 * tenant's data, generating AI-drafted nonconformity text about themselves and
 * spending the tenant's hourly quota, while ai_logs attributed genuine
 * co-pilot usage to a role the matrix says has none. `generate-report-pdf`
 * already gated this way; the AI functions did not.
 */
const AI_ALLOWED_ROLES = new Set(['super_admin', 'tenant_admin', 'lead_auditor', 'auditor']);

/**
 * Authenticates, checks the AI permission, pins the tenant, and enforces the
 * rate limit.
 *
 * The tenant is taken from the caller's own profile and the body's tenantId is
 * only ever compared against it — never trusted. A client that could name its
 * own tenant could spend another tenant's quota and pollute their usage log.
 */
export async function beginAICall(
  request: Request,
  bodyTenantId: unknown,
): Promise<AICallContext> {
  const caller = await requireCaller(request);
  if (!AI_ALLOWED_ROLES.has(caller.role)) {
    throw new HttpError(403, 'You do not have permission to use the AI co-pilot.');
  }
  if (typeof bodyTenantId === 'string' && bodyTenantId !== caller.tenantId) {
    throw new HttpError(403, 'That tenant does not match your account.');
  }
  const admin = serviceClient();

  const { data: used, error } = await admin.rpc('ai_usage_last_hour', {
    p_tenant_id: caller.tenantId,
  });
  if (error) throw new HttpError(500, 'Could not check the AI usage limit.');
  if ((used ?? 0) >= AI_RATE_LIMIT_PER_HOUR) {
    throw new HttpError(
      429,
      `This organization has reached its limit of ${AI_RATE_LIMIT_PER_HOUR} AI requests per hour.`,
    );
  }

  return { caller, admin, tenantId: caller.tenantId };
}

/**
 * Records one AI call.
 *
 * Failures to log are swallowed: a lost usage row is worse than nothing, but
 * far better than failing a request whose real work already succeeded. The
 * rate limiter reads the same table, so a dropped row can only ever be
 * permissive by one.
 */
export async function logAICall(
  context: AICallContext,
  entry: {
    feature: string;
    inputTokens?: number;
    outputTokens?: number;
    ok: boolean;
    error?: string;
  },
): Promise<void> {
  const { error } = await context.admin.from('ai_logs').insert({
    tenant_id: context.tenantId,
    actor_id: context.caller.userId,
    feature: entry.feature,
    model: CLAUDE_MODEL,
    input_tokens: entry.inputTokens ?? 0,
    output_tokens: entry.outputTokens ?? 0,
    ok: entry.ok,
    error: entry.error ?? null,
  });
  if (error) console.error('ai_logs insert failed', error);
}

/**
 * One structured Claude call, validated against `schema`.
 *
 * Structured outputs replace the section-scraping regex parser the Firebase
 * implementation used: the response shape is enforced by the API rather than
 * recovered from prose, so a model that phrases a heading differently can no
 * longer silently yield an empty field.
 */
export async function completeStructured<T>(
  context: AICallContext,
  options: {
    feature: string;
    system: string;
    prompt: string;
    schema: Record<string, unknown>;
    maxTokens?: number;
    /** Extra content blocks (e.g. an image) placed before the prompt text. */
    contentBefore?: unknown[];
  },
): Promise<T> {
  const content = [
    ...(options.contentBefore ?? []),
    { type: 'text', text: options.prompt },
  ];

  try {
    const response = await anthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: options.system,
      messages: [{ role: 'user', content: content as never }],
      output_config: {
        format: { type: 'json_schema', schema: options.schema },
      },
    } as never);

    const text = (response.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('');

    await logAICall(context, {
      feature: options.feature,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      ok: true,
    });

    return JSON.parse(text) as T;
  } catch (error) {
    // Logged as a failed call so a tenant burning its quota on errors is
    // visible, then translated into a message that never leaks provider
    // internals to the client.
    await logAICall(context, {
      feature: options.feature,
      ok: false,
      error: error instanceof Error ? error.name : 'unknown',
    });
    if (error instanceof HttpError) throw error;
    console.error(error);
    throw new HttpError(502, 'The AI co-pilot could not complete that request.');
  }
}
