/**
 * Turns an opening/closing meeting transcription into a structured record.
 *
 * The transcription is produced upstream by speech-to-text; this only
 * structures it. Nothing here writes to the meeting — the auditor confirms the
 * summary before it becomes part of the audit record.
 */
import {
  buildAuditorSystemPrompt,
  buildMeetingSummaryPrompt,
  isStandardId,
} from '../../../packages/core/dist-esm/index.mjs';
import { HttpError, handleRequest, jsonResponse } from '../_shared/auth.ts';
import { AI_DISCLAIMER, beginAICall, CLAUDE_MODEL, completeStructured } from '../_shared/ai.ts';

/** Mirrors MeetingSummaryResponse in @soteria/core. */
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    keyDecisions: { type: 'array', items: { type: 'string' } },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          owner: { type: 'string', description: '"Unassigned" when nobody was named.' },
        },
        required: ['description', 'owner'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'keyDecisions', 'actionItems'],
  additionalProperties: false,
};

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const context = await beginAICall(request, body.tenantId);

    const standardId = typeof body.standardId === 'string' ? body.standardId : 'iso45001';
    if (!isStandardId(standardId)) throw new HttpError(400, 'Unknown standard.');

    const transcription =
      typeof body.transcription === 'string' ? body.transcription.trim() : '';
    if (transcription === '') throw new HttpError(400, '"transcription" is required.');

    const meetingType = body.meetingType === 'closing' ? 'closing' : 'opening';

    const prompt = buildMeetingSummaryPrompt({
      standardId,
      meetingType,
      transcription,
      auditContext: typeof body.auditContext === 'string' ? body.auditContext : undefined,
    });

    // A full meeting transcript is long, so this gets more room than the
    // default; the summary itself is short but the input is not.
    const summary = await completeStructured(context, {
      feature: 'summarize-meeting',
      system: buildAuditorSystemPrompt(standardId),
      prompt,
      schema: SUMMARY_SCHEMA,
      maxTokens: 8192,
    });

    return jsonResponse({ summary, disclaimer: AI_DISCLAIMER, model: CLAUDE_MODEL });
  }),
);
