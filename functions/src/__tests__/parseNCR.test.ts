import { parseNCRResponse, extractClauseReferences } from '../ai/parseNCR';

describe('extractClauseReferences', () => {
  it('extracts and de-duplicates ISO clause numbers', () => {
    const refs = extractClauseReferences(
      'See Clause 6.1.2 and 6.1.2 plus 8.1.2.b and 7.4.1.',
    );
    expect(refs).toContain('6.1.2');
    expect(refs).toContain('8.1.2.b');
    expect(refs).toContain('7.4.1');
    // de-duplicated
    expect(refs.filter((r) => r === '6.1.2')).toHaveLength(1);
  });

  it('returns an empty array when no clauses are present', () => {
    expect(extractClauseReferences('no references here')).toEqual([]);
  });
});

describe('parseNCRResponse', () => {
  const sample = `NCR TITLE: Inadequate hazard identification in the machine shop
REQUIREMENT: The organization shall establish processes for hazard identification (Clause 6.1.2.1).
FINDING: Hazard identification did not cover routine maintenance tasks.
OBJECTIVE EVIDENCE: Reviewed HIRA register dated 2026-01; maintenance tasks absent.
RECOMMENDED SEVERITY: Major — systemic gap affecting multiple workers.
RELATED CLAUSES: 6.1.2.2, 8.1.2`;

  it('parses each labelled section', () => {
    const result = parseNCRResponse(sample);
    expect(result.ncrTitle).toMatch(/machine shop/i);
    expect(result.requirementStatement).toMatch(/hazard identification/i);
    expect(result.findingStatement).toMatch(/routine maintenance/i);
    expect(result.objectiveEvidenceStatement).toMatch(/HIRA register/i);
    expect(result.suggestedSeverity).toBe('major');
    expect(result.severityJustification).toMatch(/systemic/i);
    expect(result.relatedClauses).toEqual(expect.arrayContaining(['6.1.2.2', '8.1.2']));
  });

  it('defaults severity to minor when ambiguous', () => {
    const result = parseNCRResponse('FINDING: something\nRECOMMENDED SEVERITY: unclear');
    expect(result.suggestedSeverity).toBe('minor');
  });

  it('never throws on empty or malformed input', () => {
    expect(() => parseNCRResponse('')).not.toThrow();
    const empty = parseNCRResponse('');
    expect(empty.ncrTitle).toBe('');
    expect(empty.relatedClauses).toEqual([]);
  });
});
