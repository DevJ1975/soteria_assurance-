import { createClient } from '@/utils/supabase/client';
import type { NCRDraftResponse } from '@soteria/core';

export interface DraftNCRRequest {
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  auditorRawNotes: string;
  organizationContext: string;
}

export interface DraftNCRResult {
  aiDraft: NCRDraftResponse;
  disclaimer: string;
}

export interface SuggestQuestionsRequest {
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  intervieweeRole: string;
  organizationContext: string;
}

export interface SuggestQuestionsResult {
  questions: string[];
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

export async function callGenerateReportPdf(_request: {
  tenantId: string;
  auditId: string;
}): Promise<{ storagePath: string }> {
  throw new Error('Report generation Edge Function is not configured yet.');
}

export async function getDownloadUrlForPath(path: string): Promise<string> {
  const { data, error } = await createClient().storage.from('reports').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
