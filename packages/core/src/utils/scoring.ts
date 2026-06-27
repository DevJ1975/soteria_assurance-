import type { SubClauseNote, ClauseAssessment } from '../types/clause';
import type { Finding } from '../types/finding';
import type { AuditFindingsSummary } from '../types/audit';

/**
 * Weight applied to each {@link SubClauseNote.conformityVerdict} when scoring
 * a clause. `na` verdicts are excluded from the denominator entirely.
 */
const VERDICT_WEIGHTS: Record<
  Exclude<SubClauseNote['conformityVerdict'], 'na'>,
  number
> = {
  yes: 1,
  partial: 0.5,
  no: 0,
};

/**
 * Computes a 0-100 conformance score for a clause from its sub-clause
 * verdicts.
 *
 * - `yes` counts fully, `partial` counts half, `no` counts zero.
 * - `na` verdicts are ignored (excluded from both numerator and denominator).
 * - Returns `0` when there are no scorable (non-`na`) notes.
 */
export function clauseScoreFromVerdicts(notes: SubClauseNote[]): number {
  const scorable = notes.filter((note) => note.conformityVerdict !== 'na');
  if (scorable.length === 0) {
    return 0;
  }
  const total = scorable.reduce((sum, note) => {
    const verdict = note.conformityVerdict as keyof typeof VERDICT_WEIGHTS;
    return sum + VERDICT_WEIGHTS[verdict];
  }, 0);
  return Math.round((total / scorable.length) * 100);
}

/**
 * Aggregates an array of {@link Finding}s into an
 * {@link AuditFindingsSummary}.
 *
 * A nonconformity (major or minor) counts as "closed" when its status is
 * `closed`; otherwise it is "open".
 */
export function computeFindingsSummary(
  findings: Finding[],
): AuditFindingsSummary {
  const summary: AuditFindingsSummary = {
    totalFindings: findings.length,
    majorNCs: 0,
    minorNCs: 0,
    ofis: 0,
    strongPoints: 0,
    observations: 0,
    closedNCs: 0,
    openNCs: 0,
  };

  for (const finding of findings) {
    switch (finding.type) {
      case 'major_nc':
        summary.majorNCs += 1;
        break;
      case 'minor_nc':
        summary.minorNCs += 1;
        break;
      case 'ofi':
        summary.ofis += 1;
        break;
      case 'strong_point':
        summary.strongPoints += 1;
        break;
      case 'observation':
        summary.observations += 1;
        break;
    }

    if (finding.type === 'major_nc' || finding.type === 'minor_nc') {
      if (finding.status === 'closed') {
        summary.closedNCs += 1;
      } else {
        summary.openNCs += 1;
      }
    }
  }

  return summary;
}

/**
 * Computes a 0-100 certification-readiness score as the mean conformance
 * score across all audited clauses.
 *
 * Clauses with status `not_audited` or `not_applicable` are excluded. Returns
 * `0` when no clauses have been audited.
 */
export function computeCertificationReadinessScore(
  assessments: ClauseAssessment[],
): number {
  const audited = assessments.filter(
    (assessment) =>
      assessment.conformityStatus !== 'not_audited' &&
      assessment.conformityStatus !== 'not_applicable',
  );
  if (audited.length === 0) {
    return 0;
  }
  const total = audited.reduce((sum, assessment) => sum + assessment.score, 0);
  return Math.round(total / audited.length);
}
