import {
  ISO_AUDITOR_SYSTEM_PROMPT,
  buildAuditorSystemPrompt,
  buildNCRPrompt,
  buildInterviewQuestionsPrompt,
  buildMeetingSummaryPrompt,
} from '../constants/aiPrompts';
import { AI_DISCLAIMER } from '../constants/strings';
import type { NCRDraftRequest } from '../types/ai';

describe('buildAuditorSystemPrompt', () => {
  it('embeds the ARIA persona and ISO 45001 references', () => {
    const prompt = buildAuditorSystemPrompt('iso45001');
    expect(prompt).toContain('ARIA');
    expect(prompt).toContain('ISO 45001:2018');
    expect(prompt).toContain('OBJECTIVE EVIDENCE');
  });

  it('keeps the deprecated constant pointing at the ISO 45001 persona', () => {
    expect(ISO_AUDITOR_SYSTEM_PROMPT).toBe(buildAuditorSystemPrompt('iso45001'));
  });

  // The placeholder standards have no clause data, but their prompt profiles
  // are authored up front so the co-pilot is coherent the day the clauses land.
  it('builds a discipline-correct persona for ISO 14001 with no OH&S leakage', () => {
    const prompt = buildAuditorSystemPrompt('iso14001');
    expect(prompt).toContain('ISO 14001:2015');
    expect(prompt).toContain('Environmental');
    expect(prompt).not.toContain('ISO 45001');
    expect(prompt).not.toContain('OHSAS');
  });

  it('builds a discipline-correct persona for ISO 9001 with no OH&S leakage', () => {
    const prompt = buildAuditorSystemPrompt('iso9001');
    expect(prompt).toContain('ISO 9001:2015');
    expect(prompt).toContain('Quality');
    expect(prompt).not.toContain('ISO 45001');
    expect(prompt).not.toContain('OHSAS');
  });
});

describe('buildNCRPrompt', () => {
  const request: NCRDraftRequest = {
    standardId: 'iso45001',
    clauseNumber: '6.1.2',
    clauseTitle: 'Hazard identification and assessment of OH&S risks',
    requirementText: 'The organization shall establish hazard identification processes.',
    auditorRawNotes: 'Risk register missing the chemical store hazards.',
    organizationContext: 'Mid-sized chemical manufacturer, 320 employees.',
  };

  it('includes the clause number, title and auditor notes', () => {
    const prompt = buildNCRPrompt(request);
    expect(prompt).toContain('6.1.2');
    expect(prompt).toContain('Hazard identification');
    expect(prompt).toContain('chemical store hazards');
    expect(prompt).toContain('Mid-sized chemical manufacturer');
  });

  it('appends the AI disclaimer', () => {
    expect(buildNCRPrompt(request)).toContain(AI_DISCLAIMER);
  });

  it('omits the evidence block when no evidence description is given', () => {
    expect(buildNCRPrompt(request)).not.toContain('EVIDENCE DESCRIPTION');
  });

  it('includes the evidence block when an evidence description is given', () => {
    const prompt = buildNCRPrompt({
      ...request,
      evidenceDescription: 'Photo of unlabeled drums.',
    });
    expect(prompt).toContain('EVIDENCE DESCRIPTION');
    expect(prompt).toContain('unlabeled drums');
  });

  it('is deterministic for identical inputs', () => {
    expect(buildNCRPrompt(request)).toBe(buildNCRPrompt(request));
  });

  it('names the request standard rather than assuming ISO 45001', () => {
    const prompt = buildNCRPrompt({ ...request, standardId: 'iso14001' });
    expect(prompt).toContain('ISO 14001:2015');
    expect(prompt).not.toContain('ISO 45001');
  });
});

describe('buildInterviewQuestionsPrompt', () => {
  const params = {
    standardId: 'iso45001' as const,
    clauseNumber: '7.2',
    clauseTitle: 'Competence',
    intervieweeRole: 'Site Safety Supervisor',
    industry: 'Construction',
  };

  it('defaults to 5 questions', () => {
    const prompt = buildInterviewQuestionsPrompt(params);
    expect(prompt).toContain('Generate 5 ISO 45001:2018 audit interview questions');
  });

  it('honors a custom question count', () => {
    const prompt = buildInterviewQuestionsPrompt({ ...params, questionCount: 8 });
    expect(prompt).toContain('Generate 8 ISO 45001:2018');
  });

  it('includes the interviewee role and industry', () => {
    const prompt = buildInterviewQuestionsPrompt(params);
    expect(prompt).toContain('Site Safety Supervisor');
    expect(prompt).toContain('Construction');
  });

  it('omits previous responses when none are given', () => {
    expect(buildInterviewQuestionsPrompt(params)).not.toContain(
      'PREVIOUS RESPONSES',
    );
  });

  it('includes previous responses when supplied', () => {
    const prompt = buildInterviewQuestionsPrompt({
      ...params,
      previousResponses: 'Supervisor was unsure who signs off training records.',
    });
    expect(prompt).toContain('PREVIOUS RESPONSES');
    expect(prompt).toContain('training records');
  });

  it('appends the AI disclaimer', () => {
    expect(buildInterviewQuestionsPrompt(params)).toContain(AI_DISCLAIMER);
  });

  it('names the requested standard rather than assuming ISO 45001', () => {
    const prompt = buildInterviewQuestionsPrompt({ ...params, standardId: 'iso9001' });
    expect(prompt).toContain('Generate 5 ISO 9001:2015 audit interview questions');
    expect(prompt).not.toContain('ISO 45001');
  });
});

describe('buildMeetingSummaryPrompt', () => {
  const request = {
    standardId: 'iso45001' as const,
    meetingType: 'opening' as const,
    transcription: 'The lead auditor confirmed the scope and the day plan.',
  };

  it('names the meeting type and the standard', () => {
    const prompt = buildMeetingSummaryPrompt(request);
    expect(prompt).toContain('ISO 45001:2018 audit opening meeting');
    expect(prompt).toContain('ACTION ITEMS');
  });

  it('omits the context block when no audit context is given', () => {
    expect(buildMeetingSummaryPrompt(request)).not.toContain('AUDIT CONTEXT');
  });

  it('includes the context block when audit context is supplied', () => {
    const prompt = buildMeetingSummaryPrompt({
      ...request,
      auditContext: 'Acme Manufacturing — AUD-2026-001',
    });
    expect(prompt).toContain('AUDIT CONTEXT');
    expect(prompt).toContain('AUD-2026-001');
  });

  it('names the requested standard rather than assuming ISO 45001', () => {
    const prompt = buildMeetingSummaryPrompt({ ...request, standardId: 'iso14001' });
    expect(prompt).toContain('ISO 14001:2015');
    expect(prompt).not.toContain('ISO 45001');
  });

  it('appends the AI disclaimer', () => {
    expect(buildMeetingSummaryPrompt(request)).toContain(AI_DISCLAIMER);
  });
});
