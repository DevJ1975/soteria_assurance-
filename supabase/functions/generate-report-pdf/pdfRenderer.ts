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
  auditType: string;
  auditStage: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  auditDays: number;
  leadAuditorName: string;
  auditTeam: ReportTeamMember[];
  managementRepresentativeName: string;
  confidentiality: string;
  reportIssuedAt: string | null;
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
  industry: string;
  address: Record<string, unknown> | null;
  contactName: string;
  sites: Array<Record<string, unknown>>;
}

export interface ReportFinding {
  findingNumber: string;
  clauseNumber: string;
  clauseTitle: string;
  title: string;
  type: string;
  status: string;
  severity: string | null;
  /** The criterion. ISO 19011 6.5.1 requires findings to state it. */
  requirement: string;
  /** What the auditor saw, heard or reviewed. The auditee's right of reply. */
  objectiveEvidence: string;
  nonconformityStatement: string;
  raisedByAuditorName: string;
  raisedAt: string;
  targetClosureDate: string | null;
}

export interface ReportTeamMember {
  displayName: string;
  role: string;
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

  const VALUE_X = MARGIN + 320;
  const VALUE_WIDTH = PAGE_WIDTH - MARGIN - VALUE_X;

  const row = (label: string, value: string): void => {
    newPageIfNeeded(15);
    cursor.y -= 13;
    cursor.page.drawText(sanitize(label), { x: MARGIN, y: cursor.y, size: 10, font, color: INK });

    // pdf-lib does not clip: a value wider than the column runs off the page
    // edge and is simply lost. A clause title like "10.2 Incident,
    // nonconformity and corrective action" did exactly that, so the report
    // showed a criterion cut off mid-word. Ellipsize to fit instead — a
    // visibly shortened value is honest, a silently amputated one is not.
    let shown = sanitize(value);
    if (bold.widthOfTextAtSize(shown, 10) > VALUE_WIDTH) {
      while (shown.length > 1 && bold.widthOfTextAtSize(`${shown}...`, 10) > VALUE_WIDTH) {
        shown = shown.slice(0, -1);
      }
      shown = `${shown.trimEnd()}...`;
    }

    cursor.page.drawText(shown, {
      x: VALUE_X,
      y: cursor.y,
      size: 10,
      font: bold,
      color: INK,
    });
    cursor.y -= 2;
  };

  const paragraph = (text: string, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}): void => {
    // pdf-lib does not wrap. Findings carry multi-sentence prose that is the
    // substance of the report, so it has to be wrapped by hand or it runs off
    // the page and the most important text in the document is the text that
    // gets lost.
    const size = opts.size ?? 10;
    const usable = PAGE_WIDTH - MARGIN * 2;
    const lineFont = font;
    const words = sanitize(text).split(/\s+/).filter((w) => w !== '');
    let current = '';
    for (const word of words) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (lineFont.widthOfTextAtSize(candidate, size) > usable && current !== '') {
        line(current, { size, color: opts.color, gap: 2 });
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current !== '') line(current, { size, color: opts.color, gap: 2 });
  };

  const dash = (value: string | null | undefined): string =>
    value === null || value === undefined || value === '' ? '-' : value;

  // ---- Header ----
  line(s.common.appName, { size: 20, font: bold, color: NAVY, gap: 6 });
  line('Audit Report', { size: 15, font: bold, color: NAVY, gap: 6 });
  line(`${audit.auditNumber} - ${standard.name}`, { size: 12, font: bold, color: NAVY, gap: 6 });
  line(`Confidentiality: ${audit.confidentiality}`, { size: 9, color: MUTED });
  spacer(10);

  // ---- 1. Auditee (ISO 19011 6.5.1 a) ----
  sectionHeading('1. Auditee');
  row('Organization', dash(client?.organizationName));
  row('Industry', dash(client?.industry));
  row('Management representative', dash(audit.managementRepresentativeName));
  row('Sites in scope', String(client?.sites?.length ?? 0));

  // ---- 2. Audit objectives, scope and criteria (6.5.1 b, c) ----
  sectionHeading('2. Objectives, scope and criteria');
  paragraph(
    'Objective: to determine the extent of conformity of the auditee\'s occupational health and '
      + `safety management system with the requirements of ${standard.name}, to evaluate its ability `
      + 'to ensure applicable legal and other requirements are met, and to identify opportunities '
      + 'for improvement.',
  );
  spacer(4);
  line('Scope', { size: 10, font: bold });
  paragraph(dash(audit.scope));
  spacer(4);
  row('Audit criteria', standard.name);
  row('Audit type', audit.auditType.replace(/_/g, ' '));
  row('Audit stage', audit.auditStage.replace(/_/g, ' '));

  // ---- 3. Dates and audit time (6.5.1 d) ----
  sectionHeading('3. Dates and audit time');
  row('Planned', `${dash(audit.plannedStartDate)} to ${dash(audit.plannedEndDate)}`);
  row('Actual', `${dash(audit.actualStartDate)} to ${dash(audit.actualEndDate)}`);
  row('Audit days', String(audit.auditDays));
  row('Report issued', dash(audit.reportIssuedAt));

  // ---- 4. Audit team (6.5.1 e) ----
  sectionHeading('4. Audit team');
  row('Lead auditor', dash(audit.leadAuditorName));
  if (audit.auditTeam.length === 0) {
    line('No additional team members recorded.', { size: 10, color: MUTED });
  } else {
    for (const member of audit.auditTeam) {
      row(member.displayName, member.role.replace(/_/g, ' '));
    }
  }

  // ---- 5. Findings summary ----
  sectionHeading('5. Summary of findings');
  for (const r of summaryRowsFor(audit.findings)) {
    row(r.label, String(r.value));
  }

  // ---- 6. Clause-by-clause conformity ----
  sectionHeading('6. Clause-by-clause conformity');
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

  // ---- 7. Findings in full (6.5.1 f) ----
  // Each finding is rendered with its criterion, its objective evidence and
  // its nonconformity statement. A list of titles is not an audit finding:
  // the statement is what the auditee answers and what an accreditation
  // assessor traces, and omitting it made the report unusable as a record.
  sectionHeading('7. Audit findings');
  if (findings.length === 0) {
    line(s.findings.noFindings, { size: 10, color: MUTED });
  } else {
    for (const f of findings) {
      spacer(6);
      const grade = f.severity !== null && f.severity !== '' ? `${f.type} / ${f.severity}` : f.type;
      line(`${f.findingNumber}  -  ${f.title}`, { size: 11, font: bold, color: NAVY, gap: 3 });
      row('Grade', grade.replace(/_/g, ' '));
      // Not a `row`: the clause IS the criterion the finding is raised
      // against, so it must never be shortened to fit a column.
      line('Clause', { size: 9, font: bold, color: MUTED, gap: 2 });
      paragraph(`${f.clauseNumber} ${f.clauseTitle}`);
      row('Raised by', `${dash(f.raisedByAuditorName)} on ${dash(f.raisedAt.slice(0, 10))}`);
      row('Status', f.status.replace(/_/g, ' '));
      if (f.targetClosureDate !== null) row('Target closure', f.targetClosureDate);
      spacer(3);
      line('Requirement', { size: 9, font: bold, color: MUTED, gap: 2 });
      paragraph(dash(f.requirement));
      line('Objective evidence', { size: 9, font: bold, color: MUTED, gap: 2 });
      paragraph(dash(f.objectiveEvidence));
      line('Statement', { size: 9, font: bold, color: MUTED, gap: 2 });
      paragraph(dash(f.nonconformityStatement));
    }
  }

  // ---- 8. Corrective actions ----
  sectionHeading('8. Corrective actions');
  if (correctiveActions.length === 0) {
    line('No corrective actions raised for this audit.', { size: 10, color: MUTED });
  } else {
    line('# - Title - Status - Target date', { size: 9, font: bold, color: MUTED });
    for (const ca of correctiveActions) {
      line(`${ca.caNumber}  ${ca.title}  [${ca.status}]  due ${ca.targetDate}`, { size: 10 });
    }
  }

  // ---- 9. Conclusions (6.5.1 g) ----
  // ISO/IEC 17021-1 does not permit a certification decision while a major
  // nonconformity is unresolved, so the conclusion is stated from the findings
  // rather than from the conformance score, which cannot express that.
  sectionHeading('9. Audit conclusions');
  const openMajors = audit.findings.majorNCs - Math.min(audit.findings.closedNCs, audit.findings.majorNCs);
  const conclusion =
    audit.findings.majorNCs > 0
      ? `The audit identified ${audit.findings.majorNCs} major nonconformit`
        + `${audit.findings.majorNCs === 1 ? 'y' : 'ies'} against ${standard.name}. `
        + 'A certification decision cannot be made until every major nonconformity has been '
        + 'corrected and its corrective action verified as effective.'
      : audit.findings.minorNCs > 0
        ? `No major nonconformities were identified. ${audit.findings.minorNCs} minor `
          + `nonconformit${audit.findings.minorNCs === 1 ? 'y' : 'ies'} require corrective action `
          + 'within the agreed timeframe.'
        : `No nonconformities were identified against ${standard.name} within the audited scope.`;
  paragraph(conclusion);
  if (openMajors > 0) {
    spacer(4);
    paragraph(`${openMajors} major nonconformity/ies remain open at the time of issue.`, {
      color: MUTED,
    });
  }
  spacer(4);
  paragraph(
    'This report reflects the audit team\'s findings within the stated scope at the time of the '
      + 'audit. Audit sampling means the absence of a recorded nonconformity is not a guarantee '
      + 'that none exists.',
    { size: 9, color: MUTED },
  );

  // ---- 10. Distribution and approval (6.5.1) ----
  sectionHeading('10. Distribution and approval');
  paragraph(
    `Distribution is restricted to the auditee, ${s.common.appName} and, where applicable, the `
      + 'accreditation body. Confidentiality: '
      + `${audit.confidentiality}.`,
    { size: 9, color: MUTED },
  );
  spacer(14);
  row('Approved for issue by', dash(audit.leadAuditorName));
  spacer(18);
  line('Signature: ______________________________    Date: ____________________', {
    size: 10,
    color: MUTED,
  });

  // ---- Footer ----
  spacer(16);
  line(`Generated ${data.generatedAt}`, { size: 8, color: MUTED });

  return pdf.save();
}
