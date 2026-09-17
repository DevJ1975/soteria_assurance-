import { createClient } from '@/utils/supabase/client';
import { listAvailableStandards } from '@soteria/core';
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

/* ------------------------------------------------- semantic clause search */

export interface ClauseMatch {
  clause_number: string;
  clause_title: string;
  content: string;
  /** Cosine similarity, 0–1. Higher is closer in meaning. */
  similarity: number;
}

export interface SearchClausesResult {
  standardId: StandardId;
  matches: ClauseMatch[];
  model: string;
}

/**
 * Finds clauses by meaning rather than by substring.
 *
 * The wiki's own filter already handles "show me 6.1.2" and does it instantly
 * with no round trip. This is for the other question — "which requirement does
 * what I just saw bear on?" — where the auditor cannot supply the words the
 * clause happens to use.
 */
export async function callSearchClauses(request: {
  query: string;
  standardId: StandardId;
  limit?: number;
}): Promise<SearchClausesResult> {
  const { data, error } = await createClient().functions.invoke('search-clauses', {
    body: request,
  });
  if (error) throw error;
  return data as SearchClausesResult;
}

export interface IndexClausesResult {
  /** Clause count written, per standard id. */
  indexed: Record<string, number>;
  model: string;
  dimensions: number;
}

interface IndexBatchResponse {
  standardId: StandardId;
  total: number;
  processed: number;
  nextOffset: number | null;
  model: string;
  dimensions: number;
}

/**
 * Rebuilds the clause vector index. Superadmin only, enforced server-side.
 *
 * Needed after the clause dataset in @soteria/core changes — the index is
 * derived from it, so an edited clause is invisible to search until this runs.
 *
 * Drives the batch loop the Edge Function requires: embedding a whole standard
 * in one request exceeds the Edge Runtime's per-request CPU budget, so the
 * function does a slice at a time and hands back the next offset. That
 * bookkeeping lives here rather than in the component, so callers get one
 * awaitable call and the batch size stays a server-side decision.
 *
 * `onProgress` reports completed/total for the standard currently being built —
 * a rebuild is several seconds of round trips and a button that just sits there
 * looks broken.
 */
export async function callIndexClauses(
  request: { standardId?: StandardId } = {},
  onProgress?: (progress: { standardId: StandardId; done: number; total: number }) => void,
): Promise<IndexClausesResult> {
  const supabase = createClient();
  const standards: StandardId[] =
    request.standardId !== undefined
      ? [request.standardId]
      : listAvailableStandards().map((standard) => standard.id);

  const indexed: Record<string, number> = {};
  let model = 'gte-small';
  let dimensions = 384;

  for (const standardId of standards) {
    let offset: number | null = 0;
    indexed[standardId] = 0;

    while (offset !== null) {
      const { data, error } = await supabase.functions.invoke('index-clauses', {
        body: { standardId, offset },
      });
      if (error) throw error;
      const batch = data as IndexBatchResponse;

      indexed[standardId] += batch.processed;
      model = batch.model;
      dimensions = batch.dimensions;
      onProgress?.({ standardId, done: indexed[standardId], total: batch.total });

      offset = batch.nextOffset;
    }
  }

  return { indexed, model, dimensions };
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
