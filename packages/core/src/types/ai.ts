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

/**
 * Request payload for AI meeting summarisation (DESIGN_DOC §9.2 / §9.6).
 *
 * The (Whisper-compatible) speech-to-text transcription is produced upstream;
 * this request turns that raw transcript into a structured meeting record.
 */
export interface MeetingSummaryRequest {
  meetingType: 'opening' | 'closing';
  /** Full transcription of the recorded meeting. */
  transcription: string;
  /** Optional context, e.g. "Acme Manufacturing — AUD-2026-001". */
  auditContext?: string;
}

/** A single AI-extracted action item from a meeting. */
export interface MeetingSummaryActionItem {
  description: string;
  /** The person/role responsible, or "Unassigned" if none was stated. */
  owner: string;
}

/**
 * Structured response from AI meeting summarisation — maps onto the
 * `aiSummary`, `keyDecisions`, and `actionItems` fields of the Meeting model.
 */
export interface MeetingSummaryResponse {
  summary: string;
  keyDecisions: string[];
  actionItems: MeetingSummaryActionItem[];
}
