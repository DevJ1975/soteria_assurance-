import type { Finding } from './finding';
import type { AuditType, AuditStage } from './audit';

/**
 * Structured context sent with every AI co-pilot request.
 *
 * See DESIGN_DOC §9.4.
 */
export interface AIAuditContext {
  /** ISO 45001 expert auditor persona. */
  systemPrompt: string;
  auditContext: {
    clientName: string;
    industry: string;
    numberOfEmployees: number;
    auditType: AuditType;
    stage: AuditStage;
    currentClause?: string;
    currentFindings?: Partial<Finding>[];
    organizationScope?: string;
  };
  /** What the auditor is asking. */
  userRequest: string;
  /** Cached ISO clause requirement text. */
  relevantISOText?: string;
}

/**
 * Request payload for AI NCR draft generation.
 *
 * See DESIGN_DOC §10.
 */
export interface NCRDraftRequest {
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  auditorRawNotes: string;
  evidenceDescription?: string;
  organizationContext: string;
}

/**
 * Structured response from AI NCR draft generation.
 *
 * See DESIGN_DOC §10.
 */
export interface NCRDraftResponse {
  ncrTitle: string;
  requirementStatement: string;
  findingStatement: string;
  objectiveEvidenceStatement: string;
  suggestedSeverity: 'major' | 'minor';
  severityJustification: string;
  relatedClauses: string[];
}
