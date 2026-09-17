import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

/**
 * An audit programme: one client's certification cycle against one standard.
 *
 * ISO/IEC 17021-1 §9.1.2 and ISO 19011 §5 manage audits as a PROGRAMME across
 * a three-year cycle — initial certification, two surveillances, then
 * recertification — not as isolated events. Before this existed, each audit
 * stood alone: a surveillance had no traceable link to the certification
 * decision it hung off, and "were all clauses covered across the cycle?" was
 * unanswerable from the data.
 */
export interface AuditProgramme {
  id: string;
  tenantId: string;
  clientId: string;
  standardId: StandardId;

  /** ISO date. Normally the date of the initial certification decision. */
  cycleStart: string;
  /** ISO date. Three years on; recertification must complete before it. */
  cycleEnd: string;

  status: 'planned' | 'active' | 'suspended' | 'withdrawn' | 'completed';

  /**
   * The certification decision for the cycle. `pending` until the decision
   * maker — who must be someone other than the audit team, per 17021-1 §9.5 —
   * records it.
   */
  certificationDecision: 'pending' | 'granted' | 'refused' | 'suspended' | 'withdrawn';
  decidedAt?: Timestamp;
  /** Profile id of the decision maker. Must not be on the audit team. */
  decidedById?: string;
  decisionNotes?: string;

  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * One team member's declaration for one audit.
 *
 * ISO/IEC 17021-1 §5.2 requires the certification body to analyse and record
 * threats to impartiality for each engagement; §7.1–7.2 require it to
 * demonstrate that the assigned team is competent for the scope and sector.
 * These are the two records an accreditation assessor asks for first, and
 * nothing in the data model held either.
 *
 * The declaration is made by the auditor and REVIEWED by someone else — the
 * lead auditor for team members, and a tenant admin for the lead. A
 * self-reviewed impartiality declaration proves nothing.
 */
export interface AuditorDeclaration {
  id: string;
  tenantId: string;
  auditId: string;
  auditorId: string;
  auditorName: string;

  // Competence
  /**
   * Why this auditor is competent for THIS audit: relevant qualification,
   * sector experience, prior audits of this scope. Free text because the
   * evidence differs per engagement; the qualification records themselves
   * live on the profile.
   */
  competenceStatement: string;

  // Impartiality
  /** Any relationship with the auditee in the last two years, or none. */
  hasConflict: boolean;
  conflictDetails: string;
  /** How a declared conflict is mitigated, or why it is acceptable. */
  mitigation: string;

  declaredAt: Timestamp;

  // Review by someone other than the declarant
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewOutcome?: 'accepted' | 'rejected';
  reviewNotes?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
