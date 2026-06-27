import {
  clauseScoreFromVerdicts,
  computeFindingsSummary,
  computeCertificationReadinessScore,
} from '../utils/scoring';
import {
  makeFinding,
  makeClauseAssessment,
  makeSubClauseNote,
} from './testHelpers';

describe('clauseScoreFromVerdicts', () => {
  it('returns 100 when every verdict is "yes"', () => {
    const notes = [makeSubClauseNote('yes'), makeSubClauseNote('yes')];
    expect(clauseScoreFromVerdicts(notes)).toBe(100);
  });

  it('returns 0 when every verdict is "no"', () => {
    expect(clauseScoreFromVerdicts([makeSubClauseNote('no')])).toBe(0);
  });

  it('counts "partial" as half weight', () => {
    expect(clauseScoreFromVerdicts([makeSubClauseNote('partial')])).toBe(50);
  });

  it('averages mixed verdicts and rounds', () => {
    // yes(1) + no(0) + partial(0.5) = 1.5 / 3 = 0.5 → 50
    const notes = [
      makeSubClauseNote('yes'),
      makeSubClauseNote('no'),
      makeSubClauseNote('partial'),
    ];
    expect(clauseScoreFromVerdicts(notes)).toBe(50);
  });

  it('excludes "na" verdicts from the denominator', () => {
    // yes(1) + na(ignored) → 1 / 1 = 100
    const notes = [makeSubClauseNote('yes'), makeSubClauseNote('na')];
    expect(clauseScoreFromVerdicts(notes)).toBe(100);
  });

  it('returns 0 for an empty list', () => {
    expect(clauseScoreFromVerdicts([])).toBe(0);
  });

  it('returns 0 when all verdicts are "na"', () => {
    expect(clauseScoreFromVerdicts([makeSubClauseNote('na')])).toBe(0);
  });
});

describe('computeFindingsSummary', () => {
  it('tallies an empty list to all zeros', () => {
    expect(computeFindingsSummary([])).toEqual({
      totalFindings: 0,
      majorNCs: 0,
      minorNCs: 0,
      ofis: 0,
      strongPoints: 0,
      observations: 0,
      closedNCs: 0,
      openNCs: 0,
    });
  });

  it('tallies a realistic mixed audit', () => {
    const findings = [
      makeFinding({ type: 'major_nc', status: 'open' }),
      makeFinding({ type: 'minor_nc', status: 'closed' }),
      makeFinding({ type: 'minor_nc', status: 'overdue' }),
      makeFinding({ type: 'ofi' }),
      makeFinding({ type: 'strong_point' }),
      makeFinding({ type: 'observation' }),
    ];
    const summary = computeFindingsSummary(findings);
    expect(summary).toEqual({
      totalFindings: 6,
      majorNCs: 1,
      minorNCs: 2,
      ofis: 1,
      strongPoints: 1,
      observations: 1,
      closedNCs: 1,
      openNCs: 2,
    });
  });

  it('counts only NCs toward open/closed totals', () => {
    const findings = [
      makeFinding({ type: 'ofi', status: 'closed' }),
      makeFinding({ type: 'strong_point', status: 'open' }),
    ];
    const summary = computeFindingsSummary(findings);
    expect(summary.openNCs).toBe(0);
    expect(summary.closedNCs).toBe(0);
  });
});

describe('computeCertificationReadinessScore', () => {
  it('returns 0 when no clauses are audited', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'not_audited', score: 0 }),
      makeClauseAssessment({ conformityStatus: 'not_applicable', score: 0 }),
    ];
    expect(computeCertificationReadinessScore(assessments)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(computeCertificationReadinessScore([])).toBe(0);
  });

  it('averages the scores of audited clauses only', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'minor_nc', score: 60 }),
      makeClauseAssessment({ conformityStatus: 'not_audited', score: 0 }),
      makeClauseAssessment({ conformityStatus: 'not_applicable', score: 0 }),
    ];
    // (100 + 60) / 2 = 80
    expect(computeCertificationReadinessScore(assessments)).toBe(80);
  });

  it('rounds the mean to the nearest integer', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'minor_nc', score: 1 }),
    ];
    // (100 + 100 + 1) / 3 = 67
    expect(computeCertificationReadinessScore(assessments)).toBe(67);
  });
});
