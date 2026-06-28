/**
 * `suggestQuestions` callable — generates tailored ISO 45001 interview
 * questions for the current clause / interviewee / industry.
 *
 * Same guard / rate-limit / log pattern as {@link ./draftNCR}. The prompt is
 * built from `@soteria/core` (`buildInterviewQuestionsPrompt`) — no persona or
 * prompt text is duplicated here.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
  AI_DISCLAIMER,
  buildInterviewQuestionsPrompt,
  ISO_AUDITOR_SYSTEM_PROMPT,
  type InterviewQuestionsPromptParams,
} from '@soteria/core';
import { ANTHROPIC_API_KEY } from '../common/secrets';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';
import { enforceRateLimit } from './rateLimiter';
import { writeAiLog } from './aiLog';
import { callClaude, CLAUDE_MODEL } from './anthropicClient';

/** Wire payload for the `suggestQuestions` callable. */
export interface SuggestQuestionsPayload extends InterviewQuestionsPromptParams {
  tenantId: string;
}

/** Successful response — parsed questions plus disclaimer. */
export interface SuggestQuestionsResult {
  questions: string[];
  /** Raw model text (for display of any preamble). */
  raw: string;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/**
 * Splits a numbered list into individual question strings. Pure + exported for
 * testing.
 */
export function parseQuestions(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function assertPayload(data: unknown): SuggestQuestionsPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  const required: Array<keyof SuggestQuestionsPayload> = [
    'tenantId',
    'clauseNumber',
    'clauseTitle',
    'intervieweeRole',
    'industry',
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
    intervieweeRole: d['intervieweeRole'] as string,
    industry: d['industry'] as string,
    ...(typeof d['questionCount'] === 'number' ? { questionCount: d['questionCount'] } : {}),
    ...(typeof d['previousResponses'] === 'string'
      ? { previousResponses: d['previousResponses'] }
      : {}),
  };
}

/** Core handler, exported for unit testing. */
export async function handleSuggestQuestions(
  request: CallableRequest<unknown>,
): Promise<SuggestQuestionsResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'ai_copilot');

  const db = getDb();
  await enforceRateLimit(db, payload.tenantId);

  const prompt = buildInterviewQuestionsPrompt(payload);
  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, prompt);

  if (!result.ok) {
    await writeAiLog(db, payload.tenantId, {
      feature: 'suggest_questions',
      uid: auth.uid,
      model: CLAUDE_MODEL,
      status: 'error',
      errorMessage: result.error,
    });
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  await writeAiLog(db, payload.tenantId, {
    feature: 'suggest_questions',
    uid: auth.uid,
    model: result.model,
    status: 'success',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    questions: parseQuestions(result.text),
    raw: result.text,
    disclaimer: AI_DISCLAIMER,
    model: result.model,
  };
}

/** Callable export. */
export const suggestQuestions = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  handleSuggestQuestions,
);
