import {
  clauseScoreFromVerdicts,
  computeFindingsSummary,
  computeClauseConformanceScore,
  computeCertificationReadiness,
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

describe('computeClauseConformanceScore', () => {
  it('returns 0 when no clauses are audited', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'not_audited', score: 0 }),
      makeClauseAssessment({ conformityStatus: 'not_applicable', score: 0 }),
    ];
    expect(computeClauseConformanceScore(assessments)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(computeClauseConformanceScore([])).toBe(0);
  });

  it('averages the scores of audited clauses only', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'minor_nc', score: 60 }),
      makeClauseAssessment({ conformityStatus: 'not_audited', score: 0 }),
      makeClauseAssessment({ conformityStatus: 'not_applicable', score: 0 }),
    ];
    // (100 + 60) / 2 = 80
    expect(computeClauseConformanceScore(assessments)).toBe(80);
  });

  it('rounds the mean to the nearest integer', () => {
    const assessments = [
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
      makeClauseAssessment({ conformityStatus: 'minor_nc', score: 1 }),
    ];
    // (100 + 100 + 1) / 3 = 67
    expect(computeClauseConformanceScore(assessments)).toBe(67);
  });
});

describe('computeCertificationReadiness', () => {
  /** 52 conforming clauses + 1 scored 0 — the shape of the original bug. */
  const nearPerfectAssessments = [
    ...Array.from({ length: 52 }, () =>
      makeClauseAssessment({ conformityStatus: 'conforming', score: 100 }),
    ),
    makeClauseAssessment({ conformityStatus: 'major_nc', score: 0 }),
  ];

  it('is not certifiable while a major NC is open, however high the score', () => {
    const result = computeCertificationReadiness(nearPerfectAssessments, [
      { type: 'major_nc', status: 'open' },
    ]);

    // The conformance mean is still reported honestly...
    expect(result.conformanceScore).toBe(98);
    // ...but it is NOT a claim that the organization can be certified.
    expect(result.certifiable).toBe(false);
    expect(result.blockingMajorNCs).toBe(1);
  });

  it.each(['open', 'acknowledged', 'ca_submitted', 'ca_review', 'overdue'] as const)(
    'treats a major NC in status "%s" as unresolved',
    (status) => {
      const result = computeCertificationReadiness(nearPerfectAssessments, [
        { type: 'major_nc', status },
      ]);
      expect(result.certifiable).toBe(false);
    },
  );

  it('becomes certifiable once every major NC is closed', () => {
    const result = computeCertificationReadiness(nearPerfectAssessments, [
      { type: 'major_nc', status: 'closed' },
    ]);
    expect(result.certifiable).toBe(true);
    expect(result.blockingMajorNCs).toBe(0);
  });

  it('does not let minor NCs, OFIs or strong points block certification', () => {
    const result = computeCertificationReadiness(nearPerfectAssessments, [
      { type: 'minor_nc', status: 'open' },
      { type: 'ofi', status: 'open' },
      { type: 'strong_point', status: 'open' },
      { type: 'observation', status: 'open' },
    ]);
    expect(result.certifiable).toBe(true);
    expect(result.blockingMajorNCs).toBe(0);
  });

  it('counts every unresolved major NC', () => {
    const result = computeCertificationReadiness(nearPerfectAssessments, [
      { type: 'major_nc', status: 'open' },
      { type: 'major_nc', status: 'ca_review' },
      { type: 'major_nc', status: 'closed' },
    ]);
    expect(result.blockingMajorNCs).toBe(2);
  });

  it('is certifiable with no findings at all', () => {
    const result = computeCertificationReadiness(nearPerfectAssessments, []);
    expect(result.certifiable).toBe(true);
  });
});
