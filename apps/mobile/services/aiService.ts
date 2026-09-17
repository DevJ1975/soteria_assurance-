/**
 * AI co-pilot service (DESIGN_DOC §9.4 / §10).
 *
 * All AI calls run server-side in Firebase Functions (the ANTHROPIC_API_KEY
 * never touches the client — RULE 3). This module is a thin, fully-typed
 * typed client over the deployed Edge Functions (`draft-ncr`,
 * `suggestQuestions`). The wire payload/result shapes mirror the function
 * signatures in `functions/src/ai/*` and reuse `@soteria/core` request types.
 *
 * Every result carries the mandatory {@link AI_DISCLAIMER}; callers MUST show it
 * (multi-agent-guide §8) and treat output as a draft for auditor review.
 */
import {
  AI_DISCLAIMER,
  type InterviewQuestionsPromptParams,
  type MeetingSummaryRequest,
  type MeetingSummaryResponse,
  type NCRDraftRequest,
  type NCRDraftResponse,
} from '@soteria/core';
import { invokeFunction } from '../lib/functions';

/** `draftNCR` callable payload — the core request plus the caller's tenant. */
export interface DraftNCRPayload extends NCRDraftRequest {
  tenantId: string;
}

/** `draftNCR` callable result. */
export interface DraftNCRResult {
  aiDraft: NCRDraftResponse;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/** `suggestQuestions` callable payload. */
export interface SuggestQuestionsPayload extends InterviewQuestionsPromptParams {
  tenantId: string;
}

/** `suggestQuestions` callable result. */
export interface SuggestQuestionsResult {
  questions: string[];
  raw: string;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/**
 * Generate an AI draft nonconformity statement for the current clause/notes.
 * Returns the structured draft; the auditor must review + edit before saving.
 */
export async function draftNCR(payload: DraftNCRPayload): Promise<DraftNCRResult> {
  return invokeFunction<DraftNCRResult>(
    'draft-ncr',
    payload as unknown as Record<string, unknown>,
  );
}

/**
 * Generate tailored ISO 45001 interview questions for the active clause and
 * interviewee role.
 */
export async function suggestQuestions(
  payload: SuggestQuestionsPayload,
): Promise<SuggestQuestionsResult> {
  return invokeFunction<SuggestQuestionsResult>(
    'suggest-questions',
    payload as unknown as Record<string, unknown>,
  );
}

/** `summarizeMeeting` callable payload. */
export interface SummarizeMeetingPayload extends MeetingSummaryRequest {
  tenantId: string;
}

/** `summarizeMeeting` callable result. */
export interface SummarizeMeetingResult {
  summary: MeetingSummaryResponse;
  raw: string;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/**
 * Summarise a recorded opening/closing meeting transcription into a structured
 * record (summary, key decisions, action items). The auditor must review the
 * AI draft before saving it onto the meeting.
 */
export async function summarizeMeeting(
  payload: SummarizeMeetingPayload,
): Promise<SummarizeMeetingResult> {
  return invokeFunction<SummarizeMeetingResult>(
    'summarize-meeting',
    payload as unknown as Record<string, unknown>,
  );
}

/** Re-export so UI can render the disclaimer without re-importing core. */
export { AI_DISCLAIMER };
