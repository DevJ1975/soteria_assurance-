import type { SubClauseNote, ClauseAssessment } from '../types/clause';
import type { Finding } from '../types/finding';
import type { AuditFindingsSummary } from '../types/audit';
import type { StandardId } from '../standards/types';
import { getClauseByNumber } from '../standards/helpers';

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
 * The outcome of assessing an audit for certification.
 *
 * This is deliberately a structure rather than a single number. A mean across
 * clauses cannot express certifiability, and presenting one as though it could
 * is what this type exists to prevent — see
 * {@link computeCertificationReadiness}.
 */
export interface CertificationReadiness {
  /**
   * 0-100 mean conformance across audited clauses. A coverage/quality measure,
   * NOT a statement about certifiability.
   */
  conformanceScore: number;

  /**
   * `false` while any major nonconformity remains unresolved. Under
   * ISO/IEC 17021-1 a certification decision cannot be made in that state,
   * whatever the conformance score is.
   */
  certifiable: boolean;

  /** Unresolved major nonconformities — the reason `certifiable` is false. */
  blockingMajorNCs: number;
}

/**
 * Computes the 0-100 mean conformance score across audited clauses.
 *
 * Clauses with status `not_audited` or `not_applicable` are excluded. Returns
 * `0` when no clauses have been audited.
 *
 * This measures how well the audited clauses conformed. It says NOTHING about
 * whether the organization can be certified — use
 * {@link computeCertificationReadiness} for that.
 */
export function computeClauseConformanceScore(
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

/**
 * Assesses an audit for certification: the clause conformance score, plus
 * whether a certification decision is possible at all.
 *
 * WHY THIS REPLACED A BARE MEAN
 * This function used to be `computeCertificationReadinessScore(assessments)`,
 * returning only the mean above. It could not see findings, so an audit with
 * one major nonconformity scored 0 and 52 conforming clauses reported 98%
 * "certification readiness" — a figure persisted on the audit row and rendered
 * to the client organization.
 *
 * ISO/IEC 17021-1 (§9.4.8, §9.5.2) does not permit a certification decision
 * while a major nonconformity is unresolved. Certifiability is therefore not
 * an average: a single open major is disqualifying regardless of how well
 * every other clause scored. Telling a client "98% certification ready" while
 * they hold an open major is a materially misleading assertion made by the
 * certification body's own system.
 *
 * A major nonconformity counts as resolved only once its finding reaches
 * `closed`, which `computeFindingsSummary` records in `closedNCs`.
 */
export function computeCertificationReadiness(
  assessments: ClauseAssessment[],
  findings: Pick<Finding, 'type' | 'status'>[],
): CertificationReadiness {
  const blockingMajorNCs = findings.filter(
    (finding) => finding.type === 'major_nc' && finding.status !== 'closed',
  ).length;

  return {
    conformanceScore: computeClauseConformanceScore(assessments),
    certifiable: blockingMajorNCs === 0,
    blockingMajorNCs,
  };
}

/**
 * Seeds a clause's sub-clause checklist from its `typicalAuditQuestions`,
 * one note per question with no verdict yet.
 *
 * Lives here — not in either app — so web and mobile score the same clause
 * from the same questions with the same weights. Before this was shared, the
 * web editor seeded from the dataset and derived the score from verdicts,
 * while the mobile screen never seeded anything and fell back to a fixed
 * 100/60/20 per status: the same clause assessed on the two platforms from
 * the same evidence produced different scores.
 */
export function seedSubClauseNotes(
  standardId: StandardId,
  clauseNumber: string,
): SubClauseNote[] {
  const clause = getClauseByNumber(standardId, clauseNumber);
  if (clause === undefined) return [];
  return clause.typicalAuditQuestions.map((auditQuestion) => ({
    subClauseNumber: clause.number,
    requirementText: clause.requirementText,
    auditQuestion,
    auditorResponse: '',
    conformityVerdict: 'na',
  }));
}
