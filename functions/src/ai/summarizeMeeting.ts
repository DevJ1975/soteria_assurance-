/**
 * `summarizeMeeting` callable — turns a recorded opening/closing meeting
 * transcription into a structured record (DESIGN_DOC §9.2 / §9.6).
 *
 * The (Whisper-compatible) speech-to-text transcription is produced upstream
 * and passed in as `transcription`; this function extracts a professional
 * summary, the key decisions, and action items via Claude. The result maps onto
 * the `aiSummary` / `keyDecisions` / `actionItems` fields of the Meeting model
 * and, like every AI output, is auditor-unconfirmed until reviewed.
 *
 * Same guard / rate-limit / log pattern as the other AI callables.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
  AI_DISCLAIMER,
  buildMeetingSummaryPrompt,
  ISO_AUDITOR_SYSTEM_PROMPT,
  type MeetingSummaryRequest,
  type MeetingSummaryResponse,
  type MeetingSummaryActionItem,
} from '@soteria/core';
import { ANTHROPIC_API_KEY } from '../common/secrets';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';
import { enforceRateLimit } from './rateLimiter';
import { writeAiLog } from './aiLog';
import { callClaude, CLAUDE_MODEL } from './anthropicClient';

/** Wire payload for the `summarizeMeeting` callable. */
export interface SummarizeMeetingPayload extends MeetingSummaryRequest {
  tenantId: string;
}

/** Successful response — the structured summary plus disclaimer. */
export interface SummarizeMeetingResult {
  summary: MeetingSummaryResponse;
  /** Raw model text (for display of any preamble). */
  raw: string;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

/** Strips list bullets / numbering from a line. */
function stripBullet(line: string): string {
  return line.replace(/^[\s\-*•\d.)]+/, '').trim();
}

/**
 * Parses one labelled section out of the model text. Exported for reuse/testing.
 *
 * Sections are bounded by the next known heading so multi-line bodies are
 * captured intact.
 */
export function parseMeetingSection(raw: string, label: string): string {
  const headings = ['SUMMARY', 'KEY DECISIONS', 'ACTION ITEMS'];
  const others = headings.filter((h) => h !== label).join('|');
  const pattern = new RegExp(
    `(?:^|\\n)\\s*\\d*\\.?\\s*${label}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*\\d*\\.?\\s*(?:${others})\\s*[:\\-]|$)`,
    'i',
  );
  const m = pattern.exec(raw.trim());
  return m && m[1] ? m[1].trim() : '';
}

/** Splits a labelled section into non-empty, de-bulleted lines (drops "None"). */
function sectionLines(section: string): string[] {
  return section
    .split('\n')
    .map(stripBullet)
    .filter((l) => l.length > 0 && !/^none\.?$/i.test(l));
}

/**
 * Pure parser for the labelled meeting-summary text. Exported for testing.
 *
 * Action-item lines are "description — owner"; the owner defaults to
 * "Unassigned" when no separator/owner is present.
 */
export function parseMeetingSummary(raw: string): MeetingSummaryResponse {
  const keyDecisions = sectionLines(parseMeetingSection(raw, 'KEY DECISIONS'));

  const actionItems: MeetingSummaryActionItem[] = sectionLines(
    parseMeetingSection(raw, 'ACTION ITEMS'),
  ).map((line) => {
    // Split on en/em dash or hyphen surrounded by spaces, or a trailing ": owner".
    const parts = line.split(/\s+[—–-]\s+|:\s+/);
    if (parts.length >= 2) {
      const owner = parts[parts.length - 1]!.trim();
      const description = parts.slice(0, -1).join(' - ').trim();
      return { description, owner: owner.length > 0 ? owner : 'Unassigned' };
    }
    return { description: line, owner: 'Unassigned' };
  });

  return {
    summary: parseMeetingSection(raw, 'SUMMARY') || raw.trim(),
    keyDecisions,
    actionItems,
  };
}

function assertPayload(data: unknown): SummarizeMeetingPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['tenantId'] !== 'string' || (d['tenantId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantId.');
  }
  if (d['meetingType'] !== 'opening' && d['meetingType'] !== 'closing') {
    throw new HttpsError('invalid-argument', 'meetingType must be "opening" or "closing".');
  }
  if (typeof d['transcription'] !== 'string' || (d['transcription'] as string).trim().length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: transcription.');
  }
  return {
    tenantId: d['tenantId'] as string,
    meetingType: d['meetingType'],
    transcription: d['transcription'] as string,
    ...(typeof d['auditContext'] === 'string' ? { auditContext: d['auditContext'] } : {}),
  };
}

/** Core handler, exported for unit testing. */
export async function handleSummarizeMeeting(
  request: CallableRequest<unknown>,
): Promise<SummarizeMeetingResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'ai_copilot');

  const db = getDb();
  await enforceRateLimit(db, payload.tenantId);

  const prompt = buildMeetingSummaryPrompt(payload);
  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, prompt, { maxTokens: 1536 });

  if (!result.ok) {
    await writeAiLog(db, payload.tenantId, {
      feature: 'summarize_meeting',
      uid: auth.uid,
      model: CLAUDE_MODEL,
      status: 'error',
      errorMessage: result.error,
    });
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  await writeAiLog(db, payload.tenantId, {
    feature: 'summarize_meeting',
    uid: auth.uid,
    model: result.model,
    status: 'success',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    summary: parseMeetingSummary(result.text),
    raw: result.text,
    disclaimer: AI_DISCLAIMER,
    model: result.model,
  };
}

/** Callable export. */
export const summarizeMeeting = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  handleSummarizeMeeting,
);
