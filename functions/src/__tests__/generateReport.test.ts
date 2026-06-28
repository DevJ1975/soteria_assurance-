import { renderReportHtml, summaryRowsFor, type AuditReportData } from '../audit/generateReport';
import type { Audit, AuditFindingsSummary, Client, Finding } from '@soteria/core';

const summary: AuditFindingsSummary = {
  totalFindings: 3,
  majorNCs: 1,
  minorNCs: 1,
  ofis: 1,
  strongPoints: 0,
  observations: 0,
  closedNCs: 0,
  openNCs: 2,
};

describe('summaryRowsFor', () => {
  it('maps every summary field to a labelled row', () => {
    const rows = summaryRowsFor(summary);
    expect(rows).toHaveLength(8);
    expect(rows.find((r) => r.label === 'Major NCs')?.value).toBe(1);
    expect(rows.find((r) => r.label === 'Open NCs')?.value).toBe(2);
  });
});

describe('renderReportHtml', () => {
  // Minimal structural casts at the test boundary — only the fields the
  // renderer reads are populated.
  const audit = {
    auditNumber: 'AUD-2026-001',
    standard: 'ISO 45001:2018',
    scope: 'OH&S management system <site A>',
    clientId: 'c1',
    findings: summary,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial fixture
  } as any as Audit;

  const client = { organizationName: 'Acme & Co' } as Client;

  const findings = [
    {
      findingNumber: 'NCR-2026-001',
      clauseNumber: '6.1.2',
      title: 'Hazard gap',
      type: 'major_nc',
      status: 'open',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial fixture
    } as any as Finding,
  ];

  const data: AuditReportData = {
    audit,
    client,
    findings,
    generatedAt: '2026-06-27T08:00:00.000Z',
  };

  it('renders a self-contained HTML document with audit + findings data', () => {
    const html = renderReportHtml(data);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AUD-2026-001');
    expect(html).toContain('NCR-2026-001');
    expect(html).toContain('Hazard gap');
  });

  it('HTML-escapes untrusted text', () => {
    const html = renderReportHtml(data);
    expect(html).toContain('Acme &amp; Co');
    expect(html).toContain('&lt;site A&gt;');
    expect(html).not.toContain('<site A>');
  });
});
