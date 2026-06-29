/**
 * `generateReport` callable — assembles an audit report's data model and
 * renders it to HTML.
 *
 * SOTERIA RULE 2 — all reads are tenant-scoped under
 * `tenants/{tenantId}/...`. RULE 4 — user-facing labels come from
 * `@soteria/core` `SoteriaStrings`.
 *
 * PDF rendering (via puppeteer) is a deliberate follow-up: this function emits
 * a clean {@link AuditReportData} model and an HTML string. A future renderer
 * can take the same model/HTML and produce a PDF without changing this
 * contract. No puppeteer dependency is added now.
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import {
  SoteriaStrings,
  type Audit,
  type AuditFindingsSummary,
  type Client,
  type Finding,
} from '@soteria/core';
import { requireTenantMatch, requirePermission } from '../common/guards';
import { getDb } from '../common/admin';

/** A label/value pair rendered in the report's findings-summary table. */
interface SummaryRow {
  label: string;
  value: number;
}

/** Maps an {@link AuditFindingsSummary} to display rows. Pure + exported. */
export function summaryRowsFor(summary: AuditFindingsSummary): SummaryRow[] {
  return [
    { label: 'Total findings', value: summary.totalFindings },
    { label: 'Major NCs', value: summary.majorNCs },
    { label: 'Minor NCs', value: summary.minorNCs },
    { label: 'OFIs', value: summary.ofis },
    { label: 'Strong points', value: summary.strongPoints },
    { label: 'Observations', value: summary.observations },
    { label: 'Closed NCs', value: summary.closedNCs },
    { label: 'Open NCs', value: summary.openNCs },
  ];
}

/** Wire payload for `generateReport`. */
export interface GenerateReportPayload {
  tenantId: string;
  auditId: string;
}

/** The fully-assembled, render-ready report model. */
export interface AuditReportData {
  audit: Audit;
  client: Client | null;
  findings: Finding[];
  generatedAt: string;
}

/** Successful response. */
export interface GenerateReportResult {
  data: AuditReportData;
  /** Self-contained HTML document (used now for preview, later for PDF). */
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the assembled report model to a self-contained HTML document.
 *
 * Pure + exported for testing. This is the seam a future puppeteer-based PDF
 * renderer will consume — keep it dependency-free.
 */
export function renderReportHtml(data: AuditReportData): string {
  const { audit, client, findings } = data;
  const s = SoteriaStrings;
  const summaryRows = summaryRowsFor(audit.findings)
    .map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${row.value}</td></tr>`,
    )
    .join('');

  const findingRows = findings
    .map(
      (f) => `
        <tr>
          <td>${escapeHtml(f.findingNumber)}</td>
          <td>${escapeHtml(f.clauseNumber)}</td>
          <td>${escapeHtml(f.title)}</td>
          <td>${escapeHtml(f.type)}</td>
          <td>${escapeHtml(f.status)}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(s.common.appName)} — ${escapeHtml(audit.auditNumber)}</title>
</head>
<body>
<header>
  <h1>${escapeHtml(s.common.appName)}</h1>
  <h2>${escapeHtml(audit.auditNumber)} — ${escapeHtml(audit.standard)}</h2>
  <p>${escapeHtml(s.audit.scopeLabel)}: ${escapeHtml(audit.scope)}</p>
  <p>Client: ${escapeHtml(client?.organizationName ?? 'Unknown')}</p>
</header>
<section>
  <h3>${escapeHtml(s.audit.certificationReadiness)}</h3>
  <table>
    <tbody>${summaryRows}</tbody>
  </table>
</section>
<section>
  <h3>${escapeHtml(s.findings.listTitle)}</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${escapeHtml(s.findings.clauseLabel)}</th>
        <th>${escapeHtml(s.findings.titleLabel)}</th>
        <th>${escapeHtml(s.findings.typeLabel)}</th>
        <th>${escapeHtml(s.audit.statusLabel)}</th>
      </tr>
    </thead>
    <tbody>${findingRows}</tbody>
  </table>
</section>
<footer>
  <p>Generated ${escapeHtml(data.generatedAt)}</p>
</footer>
</body>
</html>`;
}

function assertPayload(data: unknown): GenerateReportPayload {
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

/**
 * Reads an audit, its client, and its findings (all tenant-scoped — RULE 2) and
 * assembles the render-ready {@link AuditReportData} model.
 *
 * Shared by the HTML (`generateReport`) and PDF (`generateReportPdf`) callables.
 * Throws `not-found` if the audit does not exist.
 */
export async function assembleReportData(
  db: Firestore,
  tenantId: string,
  auditId: string,
): Promise<AuditReportData> {
  const auditRef = db.doc(`tenants/${tenantId}/audits/${auditId}`);
  const auditSnap = await auditRef.get();
  if (!auditSnap.exists) {
    throw new HttpsError('not-found', 'Audit not found.');
  }
  const audit = auditSnap.data() as Audit;

  let client: Client | null = null;
  if (audit.clientId) {
    const clientSnap = await db.doc(`tenants/${tenantId}/clients/${audit.clientId}`).get();
    client = clientSnap.exists ? (clientSnap.data() as Client) : null;
  }

  const findingsSnap = await auditRef.collection('findings').get();
  const findings = findingsSnap.docs.map((doc) => doc.data() as Finding);

  return { audit, client, findings, generatedAt: new Date().toISOString() };
}

/** Core handler, exported for unit testing. */
export async function handleGenerateReport(
  request: CallableRequest<unknown>,
): Promise<GenerateReportResult> {
  const payload = assertPayload(request.data);
  const auth = requireTenantMatch(request, payload.tenantId);
  requirePermission(auth, 'export_reports');

  const data = await assembleReportData(getDb(), payload.tenantId, payload.auditId);
  return { data, html: renderReportHtml(data) };
}

/** Callable export. */
export const generateReport = onCall({ timeoutSeconds: 120 }, handleGenerateReport);
