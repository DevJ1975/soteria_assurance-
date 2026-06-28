/**
 * `generateReportSection` callable — drafts a narrative section of the audit
 * report (executive summary, conclusion, clause commentary, etc.).
 *
 * Same guard / rate-limit / log pattern as the other AI callables. Output is a
 * draft for auditor review (returned with the disclaimer), never auto-published
 * into the issued report.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { AI_DISCLAIMER, ISO_AUDITOR_SYSTEM_PROMPT } from '@soteria/core';
import { ANTHROPIC_API_KEY } from '../common/secrets';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';
import { enforceRateLimit } from './rateLimiter';
import { writeAiLog } from './aiLog';
import { callClaude, CLAUDE_MODEL } from './anthropicClient';

/** The narrative report sections the AI can draft. */
export type ReportSectionType =
  | 'executive_summary'
  | 'audit_conclusion'
  | 'clause_commentary'
  | 'certification_recommendation';

const SECTION_TYPES: readonly ReportSectionType[] = [
  'executive_summary',
  'audit_conclusion',
  'clause_commentary',
  'certification_recommendation',
];

/** Wire payload for `generateReportSection`. */
export interface GenerateReportSectionPayload {
  tenantId: string;
  sectionType: ReportSectionType;
  /** Structured audit facts the narrative should be grounded in. */
  auditSummary: string;
}

/** Successful response. */
export interface GenerateReportSectionResult {
  /** AI draft narrative (auditor-unconfirmed). */
  aiDraftSection: string;
  sectionType: ReportSectionType;
  disclaimer: typeof AI_DISCLAIMER;
  model: string;
}

const SECTION_INSTRUCTIONS: Record<ReportSectionType, string> = {
  executive_summary:
    'Write a concise executive summary of this ISO 45001:2018 audit suitable for senior management.',
  audit_conclusion:
    'Write the audit conclusion, summarising overall conformity and the basis for it.',
  clause_commentary:
    'Write professional clause-by-clause commentary highlighting conformity and gaps, citing clause numbers.',
  certification_recommendation:
    'Write a certification recommendation (recommend / recommend with conditions / do not recommend) with justification.',
};

/** Builds the report-section prompt. Pure + exported for testing. */
export function buildReportSectionPrompt(
  sectionType: ReportSectionType,
  auditSummary: string,
): string {
  return `You are drafting a section of a formal ISO 45001:2018 audit report.

SECTION: ${sectionType}
TASK: ${SECTION_INSTRUCTIONS[sectionType]}

AUDIT SUMMARY DATA:
${auditSummary}

Use precise, professional certification-audit language. Base the narrative only on the supplied data — do not invent findings or evidence. Cite ISO 45001:2018 clause numbers where relevant.

Note: ${AI_DISCLAIMER}.`;
}

function assertPayload(data: unknown): GenerateReportSectionPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['tenantId'] !== 'string' || (d['tenantId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantId.');
  }
  const sectionType = d['sectionType'];
  if (
    typeof sectionType !== 'string' ||
    !(SECTION_TYPES as readonly string[]).includes(sectionType)
  ) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: sectionType.');
  }
  if (typeof d['auditSummary'] !== 'string' || (d['auditSummary'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: auditSummary.');
  }
  return {
    tenantId: d['tenantId'] as string,
    sectionType: sectionType as ReportSectionType,
    auditSummary: d['auditSummary'] as string,
  };
}

/** Core handler, exported for unit testing. */
export async function handleGenerateReportSection(
  request: CallableRequest<unknown>,
): Promise<GenerateReportSectionResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'ai_copilot');

  const db = getDb();
  await enforceRateLimit(db, payload.tenantId);

  const prompt = buildReportSectionPrompt(payload.sectionType, payload.auditSummary);
  const result = await callClaude(ISO_AUDITOR_SYSTEM_PROMPT, prompt, { maxTokens: 1536 });

  if (!result.ok) {
    await writeAiLog(db, payload.tenantId, {
      feature: 'generate_report_section',
      uid: auth.uid,
      model: CLAUDE_MODEL,
      status: 'error',
      errorMessage: result.error,
    });
    throw new HttpsError('unavailable', 'The AI service is temporarily unavailable.');
  }

  await writeAiLog(db, payload.tenantId, {
    feature: 'generate_report_section',
    uid: auth.uid,
    model: result.model,
    status: 'success',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    aiDraftSection: result.text,
    sectionType: payload.sectionType,
    disclaimer: AI_DISCLAIMER,
    model: result.model,
  };
}

/** Callable export. */
export const generateReportSection = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  handleGenerateReportSection,
);
