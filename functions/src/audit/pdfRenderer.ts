/**
 * Renders an assembled {@link AuditReportData} model to a PDF document.
 *
 * This is the renderer that consumes the report seam left by
 * {@link ./generateReport}. It is dependency-light and pure (no Firestore /
 * network / browser): `pdf-lib` draws the document programmatically, so the
 * function deploys to Cloud Functions with no headless-Chromium layer and is
 * unit-testable in-process.
 *
 * @packageDocumentation
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { SoteriaStrings } from '@soteria/core';
import { summaryRowsFor, type AuditReportData } from './generateReport';

// A4 in points, with a generous margin.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BOTTOM_LIMIT = MARGIN;

// Soteria brand colours (DESIGN_DOC §14).
const NAVY = rgb(0x0a / 255, 0x26 / 255, 0x47 / 255); // primary.800 #0A2647
const MUTED = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255); // textSecondary #6B7280
const INK = rgb(0x1a / 255, 0x1d / 255, 0x23 / 255); // textPrimary #1A1D23

interface Cursor {
  page: PDFPage;
  y: number;
}

/**
 * Maps common typographic characters to ASCII and replaces anything the
 * standard Helvetica (WinAnsi) font cannot encode, so drawing never throws on
 * auditor-entered Unicode.
 */
function sanitize(value: string): string {
  return value
    .replace(/[‒-―]/g, '-') // figure/en/em dashes -> hyphen
    .replace(/[‘’]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/ /g, ' ') // non-breaking space
    .replace(/[^\x20-\x7e]/g, '?'); // any remaining non-ASCII-printable char
}

export function renderReportPdf(data: AuditReportData): Promise<Uint8Array> {
  return buildPdf(data);
}

async function buildPdf(data: AuditReportData): Promise<Uint8Array> {
  const { audit, client, findings } = data;
  const s = SoteriaStrings;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${s.common.appName} - ${audit.auditNumber}`);
  pdf.setCreator(s.common.appName);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const cursor: Cursor = { page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };

  const newPageIfNeeded = (needed: number): void => {
    if (cursor.y - needed < BOTTOM_LIMIT) {
      cursor.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.y = PAGE_HEIGHT - MARGIN;
    }
  };

  const line = (
    text: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {},
  ): void => {
    const size = opts.size ?? 11;
    const lineFont = opts.font ?? font;
    const trailing = opts.gap ?? 4;
    newPageIfNeeded(size + trailing);
    cursor.y -= size;
    cursor.page.drawText(sanitize(text), {
      x: MARGIN,
      y: cursor.y,
      size,
      font: lineFont,
      color: opts.color ?? INK,
    });
    cursor.y -= trailing;
  };

  const spacer = (h: number): void => {
    newPageIfNeeded(h);
    cursor.y -= h;
  };

  // Two-column row: label left, value in a fixed second column.
  const row = (label: string, value: string): void => {
    newPageIfNeeded(15);
    cursor.y -= 13;
    cursor.page.drawText(sanitize(label), { x: MARGIN, y: cursor.y, size: 10, font, color: INK });
    cursor.page.drawText(sanitize(value), {
      x: MARGIN + 320,
      y: cursor.y,
      size: 10,
      font: bold,
      color: INK,
    });
    cursor.y -= 2;
  };

  // ---- Header ----
  line(s.common.appName, { size: 20, font: bold, color: NAVY, gap: 6 });
  line(`${audit.auditNumber} - ${audit.standard}`, { size: 13, font: bold, color: NAVY, gap: 6 });
  line(`${s.audit.scopeLabel}: ${audit.scope}`, { size: 10, color: MUTED });
  line(`Client: ${client?.organizationName ?? 'Unknown'}`, { size: 10, color: MUTED });
  spacer(10);

  // ---- Findings summary ----
  line(s.audit.certificationReadiness, { size: 13, font: bold, color: NAVY, gap: 6 });
  for (const r of summaryRowsFor(audit.findings)) {
    row(r.label, String(r.value));
  }
  spacer(14);

  // ---- Findings list ----
  line(s.findings.listTitle, { size: 13, font: bold, color: NAVY, gap: 6 });
  if (findings.length === 0) {
    line(s.findings.noFindings, { size: 10, color: MUTED });
  } else {
    line(
      `# ${s.findings.clauseLabel} - ${s.findings.titleLabel} - ${s.findings.typeLabel} - ${s.audit.statusLabel}`,
      { size: 9, font: bold, color: MUTED },
    );
    for (const f of findings) {
      line(`${f.findingNumber}  ${f.clauseNumber}  ${f.title}  [${f.type} / ${f.status}]`, {
        size: 10,
      });
    }
  }
  spacer(16);

  // ---- Footer ----
  line(`Generated ${data.generatedAt}`, { size: 8, color: MUTED });

  return pdf.save();
}
