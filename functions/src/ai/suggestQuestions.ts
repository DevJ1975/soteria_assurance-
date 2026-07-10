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
import {
  MAX_SHORT_FIELD_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
  optionalString,
  requirePermission,
  requireString,
  requireTenantMatch,
} from '../common/guards';
import { getDb } from '../common/admin';
import { reserveRateLimitSlot } from './rateLimiter';
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

/** Bounds for the requested number of questions. */
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;

function assertPayload(data: unknown): SuggestQuestionsPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;

  // Industry/organisation context: the mobile client sends `industry`
  // (InterviewQuestionsPromptParams), the web client sends the equivalent
  // `organizationContext`. Accept either; at least one is required.
  const industry =
    optionalString(d, 'industry', MAX_TEXT_FIELD_LENGTH) ??
    optionalString(d, 'organizationContext', MAX_TEXT_FIELD_LENGTH);
  if (industry === undefined || industry.length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'Missing or invalid field: industry (or organizationContext).',
    );
  }

  const rawCount = d['questionCount'];
  if (rawCount !== undefined) {
    if (
      typeof rawCount !== 'number' ||
      !Number.isInteger(rawCount) ||
      rawCount < MIN_QUESTION_COUNT ||
      rawCount > MAX_QUESTION_COUNT
    ) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid field: questionCount (integer ${MIN_QUESTION_COUNT}-${MAX_QUESTION_COUNT}).`,
      );
    }
  }

  const previousResponses = optionalString(d, 'previousResponses', MAX_TEXT_FIELD_LENGTH);

  return {
    tenantId: requireString(d, 'tenantId', MAX_SHORT_FIELD_LENGTH),
    clauseNumber: requireString(d, 'clauseNumber', MAX_SHORT_FIELD_LENGTH),
    clauseTitle: requireString(d, 'clauseTitle', MAX_SHORT_FIELD_LENGTH),
    intervieweeRole: requireString(d, 'intervieweeRole', MAX_SHORT_FIELD_LENGTH),
    industry,
    ...(rawCount !== undefined ? { questionCount: rawCount as number } : {}),
    ...(previousResponses !== undefined ? { previousResponses } : {}),
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
  const logId = await reserveRateLimitSlot(db, payload.tenantId, {
    feature: 'suggest_questions',
    uid: auth.uid,
    model: CLAUDE_MODEL,
  });

  const prompt = buildInterviewQuestionsPrompt(payload);
  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, prompt);

  if (!result.ok) {
    await writeAiLog(
      db,
      payload.tenantId,
      {
        feature: 'suggest_questions',
        uid: auth.uid,
        model: CLAUDE_MODEL,
        status: 'error',
        errorMessage: result.error,
      },
      logId,
    );
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  await writeAiLog(
    db,
    payload.tenantId,
    {
      feature: 'suggest_questions',
      uid: auth.uid,
      model: result.model,
      status: 'success',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
    logId,
  );

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
