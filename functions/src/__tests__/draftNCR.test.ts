import { handleDraftNCR, type DraftNCRPayload } from '../ai/draftNCR';
import { buildNCRPrompt, ISO_AUDITOR_SYSTEM_PROMPT, AI_DISCLAIMER } from '@soteria/core';
import { HttpsError, type CallableRequest } from './mocks/ff-https';
import { __resetFirestore, __getState } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { __setSecret } from './mocks/ff-params';
import { __setCreate } from './mocks/anthropic';

const VALID_PAYLOAD: DraftNCRPayload = {
  tenantId: 'tenant-1',
  clauseNumber: '6.1.2',
  clauseTitle: 'Hazard identification',
  requirementText: 'The organization shall establish processes for hazard identification.',
  auditorRawNotes: 'No HIRA for maintenance tasks observed.',
  organizationContext: 'Acme Manufacturing, 250 employees.',
};

const NCR_TEXT = `NCR TITLE: Missing hazard identification for maintenance
REQUIREMENT: Clause 6.1.2 requires hazard identification processes.
FINDING: Maintenance tasks omitted from the HIRA.
OBJECTIVE EVIDENCE: HIRA register reviewed; maintenance absent.
RECOMMENDED SEVERITY: Major — systemic.
RELATED CLAUSES: 8.1.2`;

function request(
  data: unknown,
  token: Record<string, unknown> | null,
): CallableRequest<unknown> {
  return token === null ? { data } : { data, auth: { uid: 'user-1', token } };
}

const tenantToken = {
  tenantId: 'tenant-1',
  role: 'lead_auditor',
  permissions: ['ai_copilot'],
};

beforeEach(() => {
  __resetApps();
  __resetFirestore({ count: 0 });
  __setSecret('ANTHROPIC_API_KEY', 'test-key');
  __setCreate(async () => ({
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text: NCR_TEXT }],
    usage: { input_tokens: 100, output_tokens: 200 },
  }));
});

describe('handleDraftNCR — guards', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handleDraftNCR(request(VALID_PAYLOAD, null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects on tenant mismatch', async () => {
    const badToken = { ...tenantToken, tenantId: 'other-tenant' };
    await expect(handleDraftNCR(request(VALID_PAYLOAD, badToken))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects callers without ai_copilot permission', async () => {
    const noAi = { ...tenantToken, permissions: ['view_audit_reports'] };
    await expect(handleDraftNCR(request(VALID_PAYLOAD, noAi))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects invalid payloads', async () => {
    await expect(
      handleDraftNCR(request({ tenantId: 'tenant-1' }, tenantToken)),
    ).rejects.toBeInstanceOf(HttpsError);
  });
});

describe('handleDraftNCR — success', () => {
  it('returns a parsed NCR draft with the disclaimer and logs the call', async () => {
    const result = await handleDraftNCR(request(VALID_PAYLOAD, tenantToken));

    expect(result.disclaimer).toBe(AI_DISCLAIMER);
    expect(result.aiDraft.ncrTitle).toMatch(/maintenance/i);
    expect(result.aiDraft.suggestedSeverity).toBe('major');
    expect(result.aiDraft.relatedClauses).toContain('8.1.2');

    // Logged to the tenant-scoped aiLogs collection.
    const state = __getState();
    expect(state.added).toHaveLength(1);
    expect(state.added[0]?.path).toBe('tenants/tenant-1/aiLogs');
    expect(state.added[0]?.data).toMatchObject({ feature: 'draft_ncr', status: 'success' });
  });

  it('enforces the rate limit before calling the model', async () => {
    __resetFirestore({ count: 100 });
    await expect(handleDraftNCR(request(VALID_PAYLOAD, tenantToken))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('degrades gracefully and logs an error when the model fails', async () => {
    __setCreate(async () => {
      throw new Error('upstream 529');
    });
    await expect(handleDraftNCR(request(VALID_PAYLOAD, tenantToken))).rejects.toMatchObject({
      code: 'unavailable',
    });
    const state = __getState();
    expect(state.added[0]?.data).toMatchObject({ feature: 'draft_ncr', status: 'error' });
  });
});

describe('NCR prompt is built from @soteria/core', () => {
  it('includes clause data and the ARIA persona is the canonical core constant', () => {
    const prompt = buildNCRPrompt(VALID_PAYLOAD);
    expect(prompt).toContain('6.1.2');
    expect(prompt).toContain('Hazard identification');
    expect(prompt).toContain(VALID_PAYLOAD.auditorRawNotes);
    expect(ISO_AUDITOR_SYSTEM_PROMPT).toContain('ARIA');
  });
});
