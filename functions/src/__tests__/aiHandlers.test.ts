import { handleSuggestQuestions } from '../ai/suggestQuestions';
import { handleAnalyzeEvidence } from '../ai/analyzeEvidence';
import { handleGenerateReportSection } from '../ai/generateReportSection';
import { AI_DISCLAIMER } from '@soteria/core';
import { type CallableRequest } from './mocks/ff-https';
import { __resetFirestore, __getState } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { __setSecret } from './mocks/ff-params';
import { __setCreate } from './mocks/anthropic';

const token = { tenantId: 't1', role: 'auditor', permissions: ['ai_copilot'] };
const noAi = { tenantId: 't1', role: 'viewer', permissions: ['view_audit_reports'] };

function req(data: unknown, t: Record<string, unknown> | null): CallableRequest<unknown> {
  return t === null ? { data } : { data, auth: { uid: 'u1', token: t } };
}

function modelReturns(text: string): void {
  __setCreate(async () => ({
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 10, output_tokens: 20 },
  }));
}

beforeEach(() => {
  __resetApps();
  __resetFirestore({ count: 0 });
  __setSecret('ANTHROPIC_API_KEY', 'k');
});

describe('handleSuggestQuestions', () => {
  const payload = {
    tenantId: 't1',
    clauseNumber: '6.1.2',
    clauseTitle: 'Hazard identification',
    intervieweeRole: 'Safety Officer',
    industry: 'Manufacturing',
  };

  it('rejects callers without ai_copilot', async () => {
    await expect(handleSuggestQuestions(req(payload, noAi))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects invalid payloads', async () => {
    await expect(handleSuggestQuestions(req({ tenantId: 't1' }, token))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('returns parsed questions, disclaimer and logs success', async () => {
    modelReturns('1. What hazards exist?\n2. How are they controlled?');
    const result = await handleSuggestQuestions(req(payload, token));
    expect(result.questions).toHaveLength(2);
    expect(result.disclaimer).toBe(AI_DISCLAIMER);
    expect(__getState().added[0]?.data).toMatchObject({
      feature: 'suggest_questions',
      status: 'success',
    });
  });

  it('degrades gracefully and logs error on model failure', async () => {
    __setCreate(async () => {
      throw new Error('boom');
    });
    await expect(handleSuggestQuestions(req(payload, token))).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(__getState().added[0]?.data).toMatchObject({ status: 'error' });
  });
});

describe('handleAnalyzeEvidence', () => {
  const payload = {
    tenantId: 't1',
    imageBase64: 'AAAA',
    mediaType: 'image/jpeg',
  };

  it('rejects unsupported media types', async () => {
    await expect(
      handleAnalyzeEvidence(req({ ...payload, mediaType: 'image/tiff' }, token)),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns structured analysis with disclaimer', async () => {
    modelReturns(
      'DESCRIPTION: ladder\nHAZARDS:\n- fall\nPOTENTIAL CLAUSE VIOLATIONS: 8.1.2\nSUGGESTED FINDING: None',
    );
    const result = await handleAnalyzeEvidence(req(payload, token));
    expect(result.aiAnalysis.hazardsDetected).toEqual(['fall']);
    expect(result.aiAnalysis.suggestedFinding).toBe('');
    expect(result.disclaimer).toBe(AI_DISCLAIMER);
    expect(__getState().added[0]?.data).toMatchObject({ feature: 'analyze_evidence' });
  });

  it('passes auditor context into the prompt path without throwing', async () => {
    modelReturns('DESCRIPTION: ok');
    const result = await handleAnalyzeEvidence(
      req({ ...payload, contextDescription: 'machine shop' }, token),
    );
    expect(result.aiAnalysis.description).toBe('ok');
  });
});

describe('handleGenerateReportSection', () => {
  const payload = {
    tenantId: 't1',
    sectionType: 'executive_summary',
    auditSummary: 'Two minor NCs.',
  };

  it('rejects invalid section types', async () => {
    await expect(
      handleGenerateReportSection(req({ ...payload, sectionType: 'nope' }, token)),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns the AI draft section and logs success', async () => {
    modelReturns('The organization demonstrated strong conformity overall.');
    const result = await handleGenerateReportSection(req(payload, token));
    expect(result.aiDraftSection).toMatch(/conformity/i);
    expect(result.sectionType).toBe('executive_summary');
    expect(result.disclaimer).toBe(AI_DISCLAIMER);
    expect(__getState().added[0]?.data).toMatchObject({
      feature: 'generate_report_section',
      status: 'success',
    });
  });
});
