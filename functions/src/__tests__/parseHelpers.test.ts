import { parseQuestions } from '../ai/suggestQuestions';
import { parseEvidenceAnalysis } from '../ai/analyzeEvidence';
import { buildReportSectionPrompt } from '../ai/generateReportSection';
import { AI_DISCLAIMER } from '@soteria/core';

describe('parseQuestions', () => {
  it('strips list numbering and drops blank lines', () => {
    const raw = '1. What hazards exist?\n2) How are they controlled?\n\n   \n3. Who is responsible?';
    expect(parseQuestions(raw)).toEqual([
      'What hazards exist?',
      'How are they controlled?',
      'Who is responsible?',
    ]);
  });
});

describe('parseEvidenceAnalysis', () => {
  const raw = `DESCRIPTION: A worker on a ladder without fall protection.
HAZARDS:
- Fall from height
- No guardrail
POTENTIAL CLAUSE VIOLATIONS: 8.1.2, 6.1.2.b
SUGGESTED FINDING: Working at height without fall arrest.`;

  it('parses description, hazards, clauses and suggested finding', () => {
    const result = parseEvidenceAnalysis(raw);
    expect(result.description).toMatch(/ladder/i);
    expect(result.hazardsDetected).toEqual(['Fall from height', 'No guardrail']);
    expect(result.potentialClauseViolations).toEqual(
      expect.arrayContaining(['8.1.2', '6.1.2.b']),
    );
    expect(result.suggestedFinding).toMatch(/fall arrest/i);
  });

  it('treats "None" suggested finding as empty', () => {
    const result = parseEvidenceAnalysis('DESCRIPTION: ok\nSUGGESTED FINDING: None');
    expect(result.suggestedFinding).toBe('');
  });
});

describe('buildReportSectionPrompt', () => {
  it('embeds the section task, audit summary and disclaimer', () => {
    const prompt = buildReportSectionPrompt('executive_summary', 'Two minor NCs raised.');
    expect(prompt).toContain('executive_summary');
    expect(prompt).toContain('Two minor NCs raised.');
    expect(prompt).toContain(AI_DISCLAIMER);
  });
});
