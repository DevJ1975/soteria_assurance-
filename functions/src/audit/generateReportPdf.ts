/**
 * `generateReportPdf` callable — renders an audit report to PDF, stores it under
 * `tenants/{tenantId}/reports/`, and records a report document (DESIGN_DOC §9.7,
 * §12 `/reports/{auditId}/generate`).
 *
 * It reuses {@link assembleReportData} (the same tenant-scoped read used by the
 * HTML `generateReport`) and {@link renderReportPdf} (the pure pdf-lib renderer),
 * keeping the data model the single source of truth for both output formats.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb, getBucket } from '../common/admin';
import { assembleReportData } from './generateReport';
import { renderReportPdf } from './pdfRenderer';

/** Wire payload for `generateReportPdf`. */
export interface GenerateReportPdfPayload {
  tenantId: string;
  auditId: string;
}

/** Successful response — where the PDF was stored. */
export interface GenerateReportPdfResult {
  /** Storage object path within the default bucket. */
  storagePath: string;
  /** Firestore id of the recorded report document. */
  reportId: string;
  /** Bytes written. */
  size: number;
  generatedAt: string;
}

function assertPayload(data: unknown): GenerateReportPdfPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['tenantId'] !== 'string' || (d['tenantId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantId.');
  }
  if (typeof d['auditId'] !== 'string' || (d['auditId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: auditId.');
  }
  return { tenantId: d['tenantId'] as string, auditId: d['auditId'] as string };
}

/** Core handler, exported for unit testing. */
export async function handleGenerateReportPdf(
  request: CallableRequest<unknown>,
): Promise<GenerateReportPdfResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'export_reports');

  const db = getDb();
  const data = await assembleReportData(db, payload.tenantId, payload.auditId);

  const pdfBytes = await renderReportPdf(data);

  // Stable-but-unique object path; the audit number is not used in the path to
  // avoid leaking it and to keep the key filesystem-safe.
  const storagePath = `tenants/${payload.tenantId}/reports/${payload.auditId}-${Date.now()}.pdf`;
  await getBucket()
    .file(storagePath)
    .save(pdfBytes, {
      contentType: 'application/pdf',
      metadata: { metadata: { tenantId: payload.tenantId, auditId: payload.auditId } },
      resumable: false,
    });

  const reportRef = await db.collection(`tenants/${payload.tenantId}/reports`).add({
    auditId: payload.auditId,
    auditNumber: data.audit.auditNumber,
    format: 'pdf',
    storagePath,
    size: pdfBytes.byteLength,
    generatedByUid: auth.uid,
    generatedAt: Timestamp.now(),
  });

  return {
    storagePath,
    reportId: reportRef.id,
    size: pdfBytes.byteLength,
    generatedAt: data.generatedAt,
  };
}

/** Callable export. */
export const generateReportPdf = onCall({ timeoutSeconds: 120 }, handleGenerateReportPdf);
