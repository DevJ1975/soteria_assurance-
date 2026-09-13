/**
 * Renders an assembled audit report to a PDF, with pdf-lib.
 *
 * Ported from the pre-Supabase Firebase implementation
 * (functions/src/audit/pdfRenderer.ts, recovered from git history), which
 * deliberately chose pdf-lib over Puppeteer/Chromium: it is pure JavaScript
 * with no browser dependency, so it deploys anywhere the ESM bundle does —
 * confirmed to run in this project's Deno Edge Functions the same way. The
 * README's claim that report generation "needs Puppeteer" described an
 * aspiration the Firebase codebase itself never built; the code that
 * actually shipped used pdf-lib, and this is that renderer, extended for the
 * data this build now has that the old one didn't (clause-by-clause
 * conformity, corrective action status) per DESIGN_DOC §9.7's "clause-by-
 * clause conformity table" and "auto-populate all findings" bullets — while
 * deliberately not attempting the rest of that section (AI narrative
 * sections, embedded photos, signatures, watermarking, email delivery),
 * which are each their own feature, not part of closing this gap.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@^1.17.1';
import {
  CONFORMITY_STATUS_META,
  getStandard,
  interpolate,
  SoteriaStrings,
} from '../../../packages/core/dist-esm/index.mjs';

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BOTTOM_LIMIT = MARGIN;

// Soteria brand colours (DESIGN_DOC §14) — same constants the old renderer used.
const NAVY = rgb(0x0a / 255, 0x26 / 255, 0x47 / 255);
const MUTED = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const INK = rgb(0x1a / 255, 0x1d / 255, 0x23 / 255);

export interface ReportAudit {
  auditNumber: string;
  standardId: string;
  scope: string;
  status: string;
  findings: {
    totalFindings: number;
    majorNCs: number;
    minorNCs: number;
    ofis: number;
    strongPoints: number;
    observations: number;
    closedNCs: number;
    openNCs: number;
  };
}

export interface ReportClient {
  organizationName: string;
}

export interface ReportFinding {
  findingNumber: string;
  clauseNumber: string;
  title: string;
  type: string;
  status: string;
}

export interface ReportClauseAssessment {
  clauseNumber: string;
  clauseTitle: string;
  conformityStatus: string;
  score: number;
}

export interface ReportCorrectiveAction {
  caNumber: string;
  title: string;
  status: string;
  targetDate: string;
}

export interface AuditReportData {
  audit: ReportAudit;
  client: ReportClient | null;
  findings: ReportFinding[];
  clauseAssessments: ReportClauseAssessment[];
  correctiveActions: ReportCorrectiveAction[];
  generatedAt: string;
}

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
    .replace(/[‒-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7e]/g, '?');
}

function summaryRowsFor(summary: ReportAudit['findings']): Array<{ label: string; value: number }> {
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

export async function renderReportPdf(data: AuditReportData): Promise<Uint8Array> {
  const { audit, client, findings, clauseAssessments, correctiveActions } = data;
  const s = SoteriaStrings;
  const standard = getStandard(audit.standardId);

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

  const sectionHeading = (text: string): void => {
    spacer(6);
    line(text, { size: 13, font: bold, color: NAVY, gap: 6 });
  };

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
  line(`${audit.auditNumber} - ${standard.name}`, { size: 13, font: bold, color: NAVY, gap: 6 });
  line(`${interpolate(s.audit.scopeLabel, { discipline: standard.discipline })}: ${audit.scope}`, {
    size: 10,
    color: MUTED,
  });
  line(`Client: ${client?.organizationName ?? 'Unknown'}`, { size: 10, color: MUTED });
  line(`Status: ${audit.status.replace(/_/g, ' ')}`, { size: 10, color: MUTED });
  spacer(10);

  // ---- Findings summary ----
  sectionHeading(s.audit.certificationReadiness);
  for (const r of summaryRowsFor(audit.findings)) {
    row(r.label, String(r.value));
  }

  // ---- Clause-by-clause conformity (DESIGN_DOC §9.7) ----
  sectionHeading('Clause-by-clause conformity');
  if (clauseAssessments.length === 0) {
    line('No clauses have been assessed for this audit.', { size: 10, color: MUTED });
  } else {
    line(`${interpolate(s.findings.clauseLabel, { standard: standard.shortName })}  -  Status  -  Score`, {
      size: 9,
      font: bold,
      color: MUTED,
    });
    for (const c of clauseAssessments) {
      const label =
        CONFORMITY_STATUS_META[c.conformityStatus as keyof typeof CONFORMITY_STATUS_META]?.label ??
        c.conformityStatus;
      line(`${c.clauseNumber}  ${c.clauseTitle}  -  ${label}  -  ${c.score}`, { size: 10 });
    }
  }

  // ---- Findings list ----
  sectionHeading(s.findings.listTitle);
  if (findings.length === 0) {
    line(s.findings.noFindings, { size: 10, color: MUTED });
  } else {
    line(
      `# ${interpolate(s.findings.clauseLabel, { standard: standard.shortName })} - ${s.findings.titleLabel} - ${s.findings.typeLabel} - ${s.audit.statusLabel}`,
      { size: 9, font: bold, color: MUTED },
    );
    for (const f of findings) {
      line(`${f.findingNumber}  ${f.clauseNumber}  ${f.title}  [${f.type} / ${f.status}]`, {
        size: 10,
      });
    }
  }

  // ---- Corrective actions ----
  sectionHeading(s.correctiveActions.listTitle);
  if (correctiveActions.length === 0) {
    line('No corrective actions raised for this audit.', { size: 10, color: MUTED });
  } else {
    line('# - Title - Status - Target date', { size: 9, font: bold, color: MUTED });
    for (const ca of correctiveActions) {
      line(`${ca.caNumber}  ${ca.title}  [${ca.status}]  due ${ca.targetDate}`, { size: 10 });
    }
  }

  // ---- Footer ----
  spacer(16);
  line(`Generated ${data.generatedAt}`, { size: 8, color: MUTED });

  return pdf.save();
}
