/**
 * Report service — thin, typed `httpsCallable` client over the `generateReportPdf`
 * Cloud Function (DESIGN_DOC §9.7). PDF rendering and Storage writes happen
 * server-side (RULE 3 / RULE 10); this only triggers the callable and returns
 * the stored object's path, which the caller resolves to a download URL.
 */
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';

/** `generateReportPdf` callable payload. */
export interface GenerateReportPdfPayload {
  tenantId: string;
  auditId: string;
}

/** `generateReportPdf` callable result. */
export interface GenerateReportPdfResult {
  storagePath: string;
  reportId: string;
  size: number;
  generatedAt: string;
}

/** Renders the audit report to PDF server-side and returns where it was stored. */
export async function generateReportPdf(
  payload: GenerateReportPdfPayload,
): Promise<GenerateReportPdfResult> {
  const callable = httpsCallable<GenerateReportPdfPayload, GenerateReportPdfResult>(
    getFunctionsInstance(),
    'generateReportPdf',
  );
  const response = await callable(payload);
  return response.data;
}
