/**
 * Suggests interview questions for a clause, tailored to who is being
 * interviewed and the industry they work in.
 */
import {
  buildAuditorSystemPrompt,
  buildInterviewQuestionsPrompt,
  isStandardId,
} from '../../../packages/core/dist-esm/index.mjs';
import { HttpError, handleRequest, jsonResponse } from '../_shared/auth.ts';
import { AI_DISCLAIMER, beginAICall, CLAUDE_MODEL, completeStructured } from '../_shared/ai.ts';

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Open-ended questions, each citing the sub-clause it targets.',
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `"${field}" is required.`);
  }
  return value.trim();
}

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const context = await beginAICall(request, body.tenantId);

    const standardId = typeof body.standardId === 'string' ? body.standardId : 'iso45001';
    if (!isStandardId(standardId)) throw new HttpError(400, 'Unknown standard.');

    // Bounded so a caller cannot turn one request into an arbitrarily large
    // completion, which the per-request rate limit alone would not prevent.
    const requested = typeof body.questionCount === 'number' ? body.questionCount : 5;
    const questionCount = Math.min(Math.max(Math.trunc(requested), 1), 15);

    const prompt = buildInterviewQuestionsPrompt({
      standardId,
      clauseNumber: requireString(body.clauseNumber, 'clauseNumber'),
      clauseTitle: requireString(body.clauseTitle, 'clauseTitle'),
      intervieweeRole: requireString(body.intervieweeRole, 'intervieweeRole'),
      industry: typeof body.industry === 'string' ? body.industry : 'General',
      questionCount,
      previousResponses:
        typeof body.previousResponses === 'string' ? body.previousResponses : undefined,
    });

    const result = await completeStructured<{ questions: string[] }>(context, {
      feature: 'suggest-questions',
      system: buildAuditorSystemPrompt(standardId),
      prompt,
      schema: QUESTIONS_SCHEMA,
    });

    return jsonResponse({
      questions: result.questions ?? [],
      disclaimer: AI_DISCLAIMER,
      model: CLAUDE_MODEL,
    });
  }),
);
