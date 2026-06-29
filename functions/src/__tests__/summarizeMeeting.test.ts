import {
  handleSummarizeMeeting,
  parseMeetingSummary,
  parseMeetingSection,
  type SummarizeMeetingPayload,
} from '../ai/summarizeMeeting';
import { buildMeetingSummaryPrompt, AI_DISCLAIMER } from '@soteria/core';
import { HttpsError, type CallableRequest } from './mocks/ff-https';
import { __resetFirestore, __getState } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { __setSecret } from './mocks/ff-params';
import { __setCreate } from './mocks/anthropic';

const VALID_PAYLOAD: SummarizeMeetingPayload = {
  tenantId: 'tenant-1',
  meetingType: 'opening',
  transcription:
    'Lead auditor introduced the team and confirmed the scope. The MR agreed to provide HIRA records by 2pm. It was decided the closing meeting would be at 4pm.',
  auditContext: 'Acme Manufacturing — AUD-2026-001',
};

const SUMMARY_TEXT = `SUMMARY: The opening meeting confirmed the audit scope and team introductions.
KEY DECISIONS:
- Closing meeting scheduled for 4pm
- Stage 2 audit confirmed to proceed
ACTION ITEMS:
- Provide HIRA records — Management Representative
- Arrange access to the machine shop — Site Supervisor
- Confirm attendee list`;

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
    content: [{ type: 'text', text: SUMMARY_TEXT }],
    usage: { input_tokens: 120, output_tokens: 180 },
  }));
});

describe('parseMeetingSummary', () => {
  it('extracts summary, key decisions, and owner-attributed action items', () => {
    const parsed = parseMeetingSummary(SUMMARY_TEXT);
    expect(parsed.summary).toMatch(/confirmed the audit scope/i);
    expect(parsed.keyDecisions).toEqual([
      'Closing meeting scheduled for 4pm',
      'Stage 2 audit confirmed to proceed',
    ]);
    expect(parsed.actionItems).toHaveLength(3);
    expect(parsed.actionItems[0]).toEqual({
      description: 'Provide HIRA records',
      owner: 'Management Representative',
    });
    // Action item with no stated owner defaults to "Unassigned".
    expect(parsed.actionItems[2]).toEqual({
      description: 'Confirm attendee list',
      owner: 'Unassigned',
    });
  });

  it('drops "None" placeholders and falls back to raw text for a missing summary', () => {
    const parsed = parseMeetingSummary('KEY DECISIONS: None\nACTION ITEMS: None');
    expect(parsed.keyDecisions).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
    expect(parsed.summary.length).toBeGreaterThan(0);
  });

  it('parseMeetingSection captures a multi-line body bounded by the next heading', () => {
    const section = parseMeetingSection(SUMMARY_TEXT, 'KEY DECISIONS');
    expect(section).toContain('Closing meeting');
    expect(section).not.toContain('ACTION ITEMS');
  });
});

describe('handleSummarizeMeeting — guards', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handleSummarizeMeeting(request(VALID_PAYLOAD, null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects on tenant mismatch', async () => {
    const badToken = { ...tenantToken, tenantId: 'other-tenant' };
    await expect(handleSummarizeMeeting(request(VALID_PAYLOAD, badToken))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects callers without ai_copilot permission', async () => {
    const noAi = { ...tenantToken, permissions: ['view_audit_reports'] };
    await expect(handleSummarizeMeeting(request(VALID_PAYLOAD, noAi))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects an invalid meetingType', async () => {
    await expect(
      handleSummarizeMeeting(request({ ...VALID_PAYLOAD, meetingType: 'kickoff' }, tenantToken)),
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it('rejects an empty transcription', async () => {
    await expect(
      handleSummarizeMeeting(request({ ...VALID_PAYLOAD, transcription: '   ' }, tenantToken)),
    ).rejects.toBeInstanceOf(HttpsError);
  });
});

describe('handleSummarizeMeeting — success', () => {
  it('returns a structured summary with the disclaimer and logs the call', async () => {
    const result = await handleSummarizeMeeting(request(VALID_PAYLOAD, tenantToken));

    expect(result.disclaimer).toBe(AI_DISCLAIMER);
    expect(result.summary.keyDecisions.length).toBe(2);
    expect(result.summary.actionItems[0]?.owner).toBe('Management Representative');

    const state = __getState();
    expect(state.added).toHaveLength(1);
    expect(state.added[0]?.path).toBe('tenants/tenant-1/aiLogs');
    expect(state.added[0]?.data).toMatchObject({ feature: 'summarize_meeting', status: 'success' });
  });

  it('enforces the rate limit before calling the model', async () => {
    __resetFirestore({ count: 100 });
    await expect(handleSummarizeMeeting(request(VALID_PAYLOAD, tenantToken))).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
  });

  it('degrades gracefully and logs an error when the model fails', async () => {
    __setCreate(async () => {
      throw new Error('upstream 529');
    });
    await expect(handleSummarizeMeeting(request(VALID_PAYLOAD, tenantToken))).rejects.toMatchObject({
      code: 'unavailable',
    });
    const state = __getState();
    expect(state.added[0]?.data).toMatchObject({ feature: 'summarize_meeting', status: 'error' });
  });
});

describe('meeting-summary prompt is built from @soteria/core', () => {
  it('includes the transcription, audit context, and the three required sections', () => {
    const prompt = buildMeetingSummaryPrompt(VALID_PAYLOAD);
    expect(prompt).toContain(VALID_PAYLOAD.transcription);
    expect(prompt).toContain('AUD-2026-001');
    expect(prompt).toContain('SUMMARY');
    expect(prompt).toContain('KEY DECISIONS');
    expect(prompt).toContain('ACTION ITEMS');
  });
});
