/**
 * Thin client wrappers around the AI Cloud Functions. AI inference runs ONLY
 * server-side (RULE 10) — the web app reaches it via Firebase `httpsCallable`,
 * never by talking to Anthropic directly. The returned `aiDraft` is stored in
 * `aiDraft*` fields by the caller and always carries the `disclaimer` string.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@soteria/firebase';
import type { NCRDraftResponse } from '@soteria/core';

/** Request payload for the `draftNCR` callable. */
export interface DraftNCRRequest {
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  auditorRawNotes: string;
  organizationContext: string;
}

/** Result of the `draftNCR` callable — AI draft plus mandatory disclaimer. */
export interface DraftNCRResult {
  aiDraft: NCRDraftResponse;
  disclaimer: string;
}

/** Request payload for the `suggestQuestions` callable. */
export interface SuggestQuestionsRequest {
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  intervieweeRole: string;
  organizationContext: string;
}

/** Result of the `suggestQuestions` callable. */
export interface SuggestQuestionsResult {
  questions: string[];
}

/** Request payload for the `generateReportPdf` callable. */
export interface GenerateReportPdfRequest {
  tenantId: string;
  auditId: string;
}

/** Result of the `generateReportPdf` callable — where the PDF was stored. */
export interface GenerateReportPdfResult {
  storagePath: string;
  reportId: string;
  size: number;
  generatedAt: string;
}

/**
 * Renders the audit report to PDF server-side, stores it under
 * `tenants/{tenantId}/reports/`, and returns the storage path. The caller
 * resolves a download URL for that path via `getDownloadUrlForPath`.
 */
export async function callGenerateReportPdf(
  request: GenerateReportPdfRequest,
): Promise<GenerateReportPdfResult> {
  const callable = httpsCallable<GenerateReportPdfRequest, GenerateReportPdfResult>(
    getFunctions(getFirebaseApp()),
    'generateReportPdf',
  );
  const { data } = await callable(request);
  return data;
}

/** Drafts a non-conformity report from the auditor's raw notes via Claude. */
export async function callDraftNCR(request: DraftNCRRequest): Promise<DraftNCRResult> {
  const callable = httpsCallable<DraftNCRRequest, DraftNCRResult>(
    getFunctions(getFirebaseApp()),
    'draftNCR',
  );
  const { data } = await callable(request);
  return data;
}

/** Suggests interview questions for a clause / interviewee role via Claude. */
export async function callSuggestQuestions(
  request: SuggestQuestionsRequest,
): Promise<SuggestQuestionsResult> {
  const callable = httpsCallable<SuggestQuestionsRequest, SuggestQuestionsResult>(
    getFunctions(getFirebaseApp()),
    'suggestQuestions',
  );
  const { data } = await callable(request);
  return data;
}
