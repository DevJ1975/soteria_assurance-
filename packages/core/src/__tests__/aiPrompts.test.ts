import {
  ISO_AUDITOR_SYSTEM_PROMPT,
  buildNCRPrompt,
  buildInterviewQuestionsPrompt,
} from '../constants/aiPrompts';
import { AI_DISCLAIMER } from '../constants/strings';
import type { NCRDraftRequest } from '../types/ai';

describe('ISO_AUDITOR_SYSTEM_PROMPT', () => {
  it('embeds the ARIA persona and ISO 45001 references', () => {
    expect(ISO_AUDITOR_SYSTEM_PROMPT).toContain('ARIA');
    expect(ISO_AUDITOR_SYSTEM_PROMPT).toContain('ISO 45001:2018');
    expect(ISO_AUDITOR_SYSTEM_PROMPT).toContain('OBJECTIVE EVIDENCE');
  });
});

describe('buildNCRPrompt', () => {
  const request: NCRDraftRequest = {
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
});

describe('buildInterviewQuestionsPrompt', () => {
  const params = {
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
});
