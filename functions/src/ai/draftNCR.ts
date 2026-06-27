/**
 * `draftNCR` callable — generates an AI draft nonconformity statement.
 *
 * SOTERIA RULE 7 — verifies auth + tenant match, enforces the hourly rate
 * limit, builds the prompt from `@soteria/core` (no duplicated persona),
 * calls Claude, parses the response, logs to `/tenants/{tenantId}/aiLogs`,
 * and returns the draft alongside the mandatory disclaimer.
 *
 * CRITICAL — the result is returned in `aiDraft*` shape. This function NEVER
 * writes to a finding's auditor-confirmed `nonconformityStatement`; persisting
 * the auditor's confirmed copy is a separate, auditor-initiated action.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
  AI_DISCLAIMER,
  buildNCRPrompt,
  ISO_AUDITOR_SYSTEM_PROMPT,
  type NCRDraftRequest,
  type NCRDraftResponse,
} from '@soteria/core';
import { ANTHROPIC_API_KEY } from '../common/secrets';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';
import { enforceRateLimit } from './rateLimiter';
import { writeAiLog } from './aiLog';
import { callClaude, CLAUDE_MODEL } from './anthropicClient';
import { parseNCRResponse } from './parseNCR';

/** Wire payload for the `draftNCR` callable. */
export interface DraftNCRPayload extends NCRDraftRequest {
  /** Tenant the draft belongs to; must match the caller's claim. */
  tenantId: string;
}

/** Successful `draftNCR` response — AI draft plus mandatory disclaimer. */
export interface DraftNCRResult {
  /** Structured AI draft (auditor-unconfirmed). */
  aiDraft: NCRDraftResponse;
  /** Mandatory disclaimer string from `@soteria/core`. */
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

function assertPayload(data: unknown): DraftNCRPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  const required: Array<keyof DraftNCRPayload> = [
    'tenantId',
    'clauseNumber',
    'clauseTitle',
    'requirementText',
    'auditorRawNotes',
    'organizationContext',
  ];
  for (const key of required) {
    if (typeof d[key] !== 'string' || (d[key] as string).length === 0) {
      throw new HttpsError('invalid-argument', `Missing or invalid field: ${key}.`);
    }
  }
  return {
    tenantId: d['tenantId'] as string,
    clauseNumber: d['clauseNumber'] as string,
    clauseTitle: d['clauseTitle'] as string,
    requirementText: d['requirementText'] as string,
    auditorRawNotes: d['auditorRawNotes'] as string,
    organizationContext: d['organizationContext'] as string,
    ...(typeof d['evidenceDescription'] === 'string'
      ? { evidenceDescription: d['evidenceDescription'] }
      : {}),
  };
}

/**
 * Core handler, exported for unit testing without the onCall HTTP wrapper.
 */
export async function handleDraftNCR(
  request: CallableRequest<unknown>,
): Promise<DraftNCRResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  // Drafting NCRs requires the AI co-pilot capability.
  requirePermission(auth, 'ai_copilot');

  const db = getDb();
  await enforceRateLimit(db, payload.tenantId);

  const prompt = buildNCRPrompt(payload);
  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, prompt);

  if (!result.ok) {
    await writeAiLog(db, payload.tenantId, {
      feature: 'draft_ncr',
      uid: auth.uid,
      model: CLAUDE_MODEL,
      status: 'error',
      errorMessage: result.error,
    });
    // Graceful degradation — the client can fall back to manual drafting.
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  const aiDraft = parseNCRResponse(result.text);

  await writeAiLog(db, payload.tenantId, {
    feature: 'draft_ncr',
    uid: auth.uid,
    model: result.model,
    status: 'success',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return { aiDraft, disclaimer: AI_DISCLAIMER, model: result.model };
}

/** Callable export with the Anthropic secret bound and a 60s function budget. */
export const draftNCR = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  handleDraftNCR,
);
