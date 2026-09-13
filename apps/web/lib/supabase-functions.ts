import { createClient } from '@/utils/supabase/client';
import type {
  MeetingSummaryResponse,
  NCRDraftResponse,
  StandardId,
} from '@soteria/core';
import { createSignedDownloadUrl } from './supabase-storage';

export interface DraftNCRRequest {
  tenantId: string;
  /** Which standard the clause belongs to — the prompt differs per standard. */
  standardId: StandardId;
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  auditorRawNotes: string;
  organizationContext: string;
}

export interface DraftNCRResult {
  /**
   * An UNCONFIRMED draft. The caller stores it in the finding's `aiDraft*`
   * fields; the auditor-confirmed wording is only ever written by an explicit
   * auditor action, because the auditor is accountable for what an NCR says.
   */
  aiDraft: NCRDraftResponse;
  disclaimer: string;
  model: string;
}

export interface SuggestQuestionsRequest {
  tenantId: string;
  standardId: StandardId;
  clauseNumber: string;
  clauseTitle: string;
  intervieweeRole: string;
  organizationContext: string;
}

export interface SuggestQuestionsResult {
  questions: string[];
  disclaimer: string;
  model: string;
}

export interface AnalyzeEvidenceRequest {
  tenantId: string;
  standardId: StandardId;
  /** The stored evidence row; the function reads the file server-side. */
  evidenceId: string;
}

export interface AnalyzeEvidenceResult {
  analysis: string;
  hazards: string[];
  suggestedClauses: string[];
  disclaimer: string;
  model: string;
}

export interface SummarizeMeetingRequest {
  tenantId: string;
  standardId: StandardId;
  meetingType: 'opening' | 'closing';
  transcription: string;
  auditContext?: string;
}

export interface SummarizeMeetingResult {
  summary: MeetingSummaryResponse;
  disclaimer: string;
  model: string;
}

export async function callDraftNCR(request: DraftNCRRequest): Promise<DraftNCRResult> {
  const { data, error } = await createClient().functions.invoke('draft-ncr', { body: request });
  if (error) throw error;
  return data as DraftNCRResult;
}

export async function callSuggestQuestions(
  request: SuggestQuestionsRequest,
): Promise<SuggestQuestionsResult> {
  const { data, error } = await createClient().functions.invoke('suggest-questions', {
    body: request,
  });
  if (error) throw error;
  return data as SuggestQuestionsResult;
}

/** Analyses a stored evidence photograph for visible hazards. */
export async function callAnalyzeEvidence(
  request: AnalyzeEvidenceRequest,
): Promise<AnalyzeEvidenceResult> {
  const { data, error } = await createClient().functions.invoke('analyze-evidence', {
    body: request,
  });
  if (error) throw error;
  return data as AnalyzeEvidenceResult;
}

/** Structures a meeting transcription into summary, decisions and actions. */
export async function callSummarizeMeeting(
  request: SummarizeMeetingRequest,
): Promise<SummarizeMeetingResult> {
  const { data, error } = await createClient().functions.invoke('summarize-meeting', {
    body: request,
  });
  if (error) throw error;
  return data as SummarizeMeetingResult;
}

export interface GenerateReportPdfResult {
  storagePath: string;
  reportId: string | null;
  size: number;
  generatedAt: string;
}

/**
 * Renders the audit report to PDF server-side and stores it in the private
 * `reports` bucket.
 *
 * The earlier assumption here was that this needed a Chromium-capable
 * runtime, because the Firebase-era README documented Puppeteer. That
 * documentation described an aspiration the Firebase codebase itself never
 * built: the code that actually shipped
 * (functions/src/audit/{pdfRenderer,generateReportPdf}.ts, recovered from git
 * history) rendered with pdf-lib — pure JavaScript, no browser — which is
 * exactly why it runs as an Edge Function here.
 */
export async function callGenerateReportPdf(request: {
  tenantId: string;
  auditId: string;
}): Promise<GenerateReportPdfResult> {
  const { data, error } = await createClient().functions.invoke('generate-report-pdf', {
    body: request,
  });
  if (error) throw error;
  return data as GenerateReportPdfResult;
}

/**
 * Signs a report object for download. Report objects are private, so the link
 * expires; see `supabase-storage.ts` for the other buckets.
 */
export async function getDownloadUrlForPath(path: string): Promise<string> {
  return createSignedDownloadUrl('reports', path);
}
