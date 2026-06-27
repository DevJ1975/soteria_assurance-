import { onAuditComplete } from '../audit/onAuditComplete';
import { caReminders } from '../notifications/caReminders';
import { generateReport, handleGenerateReport } from '../audit/generateReport';
import { type CallableRequest } from './mocks/ff-https';
import { __resetFirestore, __getState } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { __setSecret } from './mocks/ff-params';

// The mock onDocumentUpdated/onSchedule return the bare handler, so the
// deployed export is directly invokable in tests.
type TriggerEvent = Parameters<typeof onAuditComplete>[0];

beforeEach(() => {
  __resetApps();
  __resetFirestore();
});

describe('onAuditComplete trigger', () => {
  it('recomputes the findings summary on a qualifying status change', async () => {
    __resetFirestore({
      subcollections: {
        'tenants/t1/audits/a1/findings': [
          { id: 'f1', data: { type: 'major_nc', status: 'open' } },
          { id: 'f2', data: { type: 'minor_nc', status: 'closed' } },
        ],
      },
    });

    const event = {
      params: { tenantId: 't1', auditId: 'a1' },
      data: {
        before: { data: () => ({ status: 'in_progress' }) },
        after: { data: () => ({ status: 'findings_review' }) },
      },
    } as unknown as TriggerEvent;

    await onAuditComplete(event);

    const updated = __getState().updated;
    expect(updated).toHaveLength(1);
    expect(updated[0]?.path).toBe('tenants/t1/audits/a1');
    expect(updated[0]?.data).toMatchObject({
      findings: expect.objectContaining({ totalFindings: 2, majorNCs: 1 }),
    });
  });

  it('does nothing when the status did not change into a summary state', async () => {
    const event = {
      params: { tenantId: 't1', auditId: 'a1' },
      data: {
        before: { data: () => ({ status: 'in_progress' }) },
        after: { data: () => ({ status: 'in_progress' }) },
      },
    } as unknown as TriggerEvent;

    await onAuditComplete(event);
    expect(__getState().updated).toHaveLength(0);
  });
});

describe('caReminders scheduled handler', () => {
  it('emails reminders for findings due today (SendGrid unset → skipped, no throw)', async () => {
    __setSecret('SENDGRID_API_KEY', '');
    __resetFirestore({
      groupDocs: [
        {
          id: 'f1',
          data: {
            id: 'f1',
            tenantId: 't1',
            findingNumber: 'NCR-2026-001',
            title: 'Gap',
            status: 'open',
            targetClosureDate: new Date(Date.now() + 7 * 24 * 3600 * 1000)
              .toISOString()
              .slice(0, 10),
          },
        },
      ],
    });

    // Should resolve without throwing even though email is skipped.
    await expect(caReminders()).resolves.toBeUndefined();
  });
});

describe('generateReport handler', () => {
  const token = { tenantId: 't1', role: 'lead_auditor', permissions: ['export_reports'] };
  function req(data: unknown): CallableRequest<unknown> {
    return { data, auth: { uid: 'u1', token } };
  }

  it('throws not-found when the audit is absent', async () => {
    await expect(
      handleGenerateReport(req({ tenantId: 't1', auditId: 'missing' })),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('assembles tenant-scoped data and renders HTML', async () => {
    __resetFirestore({
      docs: {
        'tenants/t1/audits/a1': {
          auditNumber: 'AUD-2026-001',
          standard: 'ISO 45001:2018',
          scope: 'Scope',
          clientId: 'c1',
          findings: {
            totalFindings: 0,
            majorNCs: 0,
            minorNCs: 0,
            ofis: 0,
            strongPoints: 0,
            observations: 0,
            closedNCs: 0,
            openNCs: 0,
          },
        },
        'tenants/t1/clients/c1': { organizationName: 'Acme' },
      },
      subcollections: { 'tenants/t1/audits/a1/findings': [] },
    });

    const result = await handleGenerateReport(req({ tenantId: 't1', auditId: 'a1' }));
    expect(result.data.audit.auditNumber).toBe('AUD-2026-001');
    expect(result.data.client?.organizationName).toBe('Acme');
    expect(result.html).toContain('AUD-2026-001');
  });

  it('rejects callers without export_reports', async () => {
    const r: CallableRequest<unknown> = {
      data: { tenantId: 't1', auditId: 'a1' },
      auth: { uid: 'u1', token: { tenantId: 't1', role: 'viewer', permissions: [] } },
    };
    await expect(handleGenerateReport(r)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('is exported as a callable handle', () => {
    expect(typeof generateReport).toBe('function');
  });
});
