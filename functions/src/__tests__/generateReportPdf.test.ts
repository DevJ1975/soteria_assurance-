import {
  handleGenerateReportPdf,
  type GenerateReportPdfPayload,
} from '../audit/generateReportPdf';
import { renderReportPdf } from '../audit/pdfRenderer';
import type { AuditReportData } from '../audit/generateReport';
import type { Audit, AuditFindingsSummary, Client, Finding } from '@soteria/core';
import { HttpsError, type CallableRequest } from './mocks/ff-https';
import { __resetFirestore, __getState } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { __resetStorage, __getSavedFiles } from './mocks/admin-storage';

const summary: AuditFindingsSummary = {
  totalFindings: 2,
  majorNCs: 1,
  minorNCs: 0,
  ofis: 1,
  strongPoints: 0,
  observations: 0,
  closedNCs: 0,
  openNCs: 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial test fixtures
const audit = {
  auditNumber: 'AUD-2026-009',
  standard: 'ISO 45001:2018',
  scope: 'OH&S management system — “Site A” café & workshop',
  clientId: 'c1',
  findings: summary,
} as any as Audit;

const client = { organizationName: 'Açme Industrías' } as Client;

const findings = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partial fixture
  {
    findingNumber: 'NCR-2026-001',
    clauseNumber: '6.1.2',
    title: 'Hazard identification gap — maintenance',
    type: 'major_nc',
    status: 'open',
  } as any as Finding,
];

const reportData: AuditReportData = {
  audit,
  client,
  findings,
  generatedAt: '2026-06-28T09:00:00.000Z',
};

describe('renderReportPdf', () => {
  it('produces a non-empty PDF document (valid %PDF header)', async () => {
    const bytes = await renderReportPdf(reportData);
    expect(bytes.byteLength).toBeGreaterThan(500);
    // %PDF magic number.
    expect(Array.from(bytes.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it('renders without throwing on empty findings and Unicode text', async () => {
    const bytes = await renderReportPdf({ ...reportData, findings: [] });
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});

function request(
  data: unknown,
  token: Record<string, unknown> | null,
): CallableRequest<unknown> {
  return token === null ? { data } : { data, auth: { uid: 'user-1', token } };
}

const tenantToken = {
  tenantId: 'tenant-1',
  role: 'lead_auditor',
  permissions: ['export_reports'],
};

const VALID_PAYLOAD: GenerateReportPdfPayload = { tenantId: 'tenant-1', auditId: 'audit-1' };

function seedAudit(): void {
  __resetFirestore({
    docs: {
      'tenants/tenant-1/audits/audit-1': audit,
      'tenants/tenant-1/clients/c1': client,
    },
    subcollections: {
      'tenants/tenant-1/audits/audit-1/findings': [{ id: 'f1', data: findings[0] }],
    },
  });
}

beforeEach(() => {
  __resetApps();
  __resetStorage();
  seedAudit();
});

describe('handleGenerateReportPdf — guards', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handleGenerateReportPdf(request(VALID_PAYLOAD, null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects on tenant mismatch', async () => {
    const badToken = { ...tenantToken, tenantId: 'other' };
    await expect(handleGenerateReportPdf(request(VALID_PAYLOAD, badToken))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects callers without export_reports permission', async () => {
    const noExport = { ...tenantToken, permissions: ['ai_copilot'] };
    await expect(
      handleGenerateReportPdf(request(VALID_PAYLOAD, noExport)),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects invalid payloads', async () => {
    await expect(
      handleGenerateReportPdf(request({ tenantId: 'tenant-1' }, tenantToken)),
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it('returns not-found when the audit does not exist', async () => {
    __resetFirestore({ docs: {} });
    await expect(handleGenerateReportPdf(request(VALID_PAYLOAD, tenantToken))).rejects.toMatchObject(
      { code: 'not-found' },
    );
  });
});

describe('handleGenerateReportPdf — success', () => {
  it('uploads a PDF to a tenant-scoped path and records a report document', async () => {
    const result = await handleGenerateReportPdf(request(VALID_PAYLOAD, tenantToken));

    expect(result.storagePath).toMatch(/^tenants\/tenant-1\/reports\/audit-1-\d+\.pdf$/);
    expect(result.size).toBeGreaterThan(500);
    expect(result.reportId).toBeTruthy();

    // The PDF bytes were written to Storage as application/pdf.
    const saved = __getSavedFiles();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.path).toBe(result.storagePath);
    expect(saved[0]?.contentType).toBe('application/pdf');
    expect(Array.from(saved[0]!.contents.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);

    // A report document was appended to the tenant-scoped reports collection.
    const state = __getState();
    const reportAdd = state.added.find((a) => a.path === 'tenants/tenant-1/reports');
    expect(reportAdd?.data).toMatchObject({
      auditId: 'audit-1',
      auditNumber: 'AUD-2026-009',
      format: 'pdf',
      storagePath: result.storagePath,
      generatedByUid: 'user-1',
    });
  });
});
