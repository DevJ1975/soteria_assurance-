import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

export type ConformityStatus =
  | 'conforming'
  | 'major_nc'
  | 'minor_nc'
  | 'not_audited'
  | 'not_applicable';

export type ConformityVerdict = 'yes' | 'no' | 'partial' | 'na';

export interface SubClauseNote {
  /** e.g. "6.1.2.a". */
  subClauseNumber: string;
  /** Paraphrased requirement text for the sub-clause. */
  requirementText: string;
  /** Standard audit question. */
  auditQuestion: string;
  /** What was found. */
  auditorResponse: string;
  conformityVerdict: ConformityVerdict;
  aiSuggestedFollowUp?: string;
}

/**
 * The assessment of a single clause within an audit.
 */
export interface ClauseAssessment {
  id: string;
  auditId: string;
  tenantId: string;
  /**
   * The standard the clause belongs to, denormalized from the parent audit so
   * a clause number is never ambiguous on its own ("6.1.2" exists in every
   * Annex SL standard).
   */
  standardId: StandardId;
  /** e.g. "4.1", "6.1.2", "9.2.1". */
  clauseNumber: string;
  clauseTitle: string;
  assignedAuditorId: string;

  // Assessment Results
  conformityStatus: ConformityStatus;
  /** 0-100 percentage conformance. */
  score: number;

  // Notes
  auditorNotes: string;
  aiGeneratedSummary?: string;

  // Evidence References
  evidenceIds: string[];
  findingIds: string[];

  // Interview Notes by Sub-clause
  subClauseNotes: SubClauseNote[];

  // Completion
  isComplete: boolean;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}
