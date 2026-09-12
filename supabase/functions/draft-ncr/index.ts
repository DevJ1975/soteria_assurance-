/**
 * Drafts a formal nonconformity statement from an auditor's raw notes.
 *
 * The result is explicitly an UNCONFIRMED draft. It is returned in `aiDraft`
 * shape and this function never writes to a finding — persisting the confirmed
 * wording stays an auditor-initiated action, because the auditor, not the
 * model, is accountable for what an NCR says.
 */
import {
  buildAuditorSystemPrompt,
  buildNCRPrompt,
  isStandardId,
} from '../../../packages/core/dist-esm/index.mjs';
import { HttpError, handleRequest, jsonResponse } from '../_shared/auth.ts';
import { AI_DISCLAIMER, beginAICall, CLAUDE_MODEL, completeStructured } from '../_shared/ai.ts';

/** Mirrors NCRDraftResponse in @soteria/core. */
const NCR_SCHEMA = {
  type: 'object',
  properties: {
    ncrTitle: { type: 'string', description: 'Short descriptive title.' },
    requirementStatement: { type: 'string', description: 'What the standard requires.' },
    findingStatement: { type: 'string', description: 'What was observed that does not conform.' },
    objectiveEvidenceStatement: { type: 'string', description: 'The specific evidence observed.' },
    suggestedSeverity: { type: 'string', enum: ['major', 'minor'] },
    severityJustification: { type: 'string' },
    relatedClauses: {
      type: 'array',
      items: { type: 'string' },
      description: 'Other clause numbers of the same standard that are affected.',
    },
  },
  required: [
    'ncrTitle',
    'requirementStatement',
    'findingStatement',
    'objectiveEvidenceStatement',
    'suggestedSeverity',
    'severityJustification',
    'relatedClauses',
  ],
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

    const prompt = buildNCRPrompt({
      standardId,
      clauseNumber: requireString(body.clauseNumber, 'clauseNumber'),
      clauseTitle: requireString(body.clauseTitle, 'clauseTitle'),
      requirementText: requireString(body.requirementText, 'requirementText'),
      auditorRawNotes: requireString(body.auditorRawNotes, 'auditorRawNotes'),
      organizationContext: requireString(body.organizationContext, 'organizationContext'),
      evidenceDescription:
        typeof body.evidenceDescription === 'string' ? body.evidenceDescription : undefined,
    });

    const aiDraft = await completeStructured(context, {
      feature: 'draft-ncr',
      system: buildAuditorSystemPrompt(standardId),
      prompt,
      schema: NCR_SCHEMA,
    });

    return jsonResponse({ aiDraft, disclaimer: AI_DISCLAIMER, model: CLAUDE_MODEL });
  }),
);
