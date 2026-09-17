import type { Timestamp } from './common';

export type FindingType =
  | 'major_nc'
  | 'minor_nc'
  | 'ofi'
  | 'strong_point'
  | 'observation';

export type FindingStatus =
  | 'open'
  | 'acknowledged'
  | 'ca_submitted'
  | 'ca_review'
  | 'closed'
  | 'overdue';

export type CAStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'closed';

/**
 * A finding raised during an audit (NCR, OFI, strong point or observation).
 */
export interface Finding {
  id: string;
  auditId: string;
  tenantId: string;
  clientId: string;

  // Classification
  /** e.g. "NCR-2026-001". */
  findingNumber: string;
  type: FindingType;
  /** Only for nonconformities. */
  severity?: 'major' | 'minor';

  // Standard Reference
  /** e.g. "6.1.2". */
  clauseNumber: string;
  clauseTitle: string;
  /**
   * PARAPHRASED requirement text, copied from the clause dataset when the
   * finding is raised.
   *
   * This said "Exact ISO requirement text", which contradicted the rest of the
   * codebase: `StandardClause.requirementText` is deliberately paraphrased and
   * never copied verbatim from the published standard, precisely because this
   * value ends up in a client-delivered NCR. Following the old instruction
   * would have put copyrighted ISO text into a deliverable; not following it
   * meant the field carried a paraphrase while the type claimed otherwise, and
   * an auditee challenging an NCR on the exact wording of the requirement got
   * a paraphrase presented as exact.
   *
   * Populate from `getClauseByNumber(standardId, clauseNumber)?.requirementText`.
   */
  requirement: string;

  // Finding Content
  /** Short descriptive title. */
  title: string;
  /** What was observed. */
  objectiveEvidence: string;
  /** Formal NCR statement. */
  nonconformityStatement: string;
  /** AI-generated draft. */
  aiDraftStatement?: string;

  // Location
  siteId?: string;
  department?: string;
  area?: string;

  // Evidence
  evidenceIds: string[];

  // Auditor
  raisedByAuditorId: string;
  raisedByAuditorName: string;
  raisedAt: Timestamp;

  // Acceptance
  acknowledgedByName?: string;
  acknowledgedBySignatureUrl?: string;
  acknowledgedAt?: Timestamp;

  // Corrective Action
  correctiveActionId?: string;
  correctiveActionStatus?: CAStatus;
  targetClosureDate?: string;
  actualClosureDate?: string;

  // Status
  status: FindingStatus;
  closedAt?: Timestamp;
  closedByAuditorId?: string;

  updatedAt: Timestamp;
}
