import type { Timestamp } from './common';
import type { AuditType } from './audit';
import type { MeetingAgendaItem } from './meeting';

export interface AuditQuestion {
  questionId: string;
  questionText: string;
  /** ISO 45001 clause requirement text. */
  requirementReference: string;
  evidenceExpected: string;
  aiPromptHint?: string;
  isRequired: boolean;
  order: number;
}

export interface ClauseQuestionSet {
  clauseNumber: string;
  clauseTitle: string;
  questions: AuditQuestion[];
}

export interface DocumentReviewItem {
  itemId: string;
  documentName: string;
  clauseReference: string;
  isRequired: boolean;
  purpose: string;
}

export interface InspectionChecklistItem {
  itemId: string;
  area: string;
  checkPoint: string;
  clauseReference: string;
  hazardType?: string;
  isRequired: boolean;
}

/**
 * A reusable audit template scoped to a tenant.
 */
export interface AuditTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  standard: 'ISO 45001:2018';
  auditType: AuditType;

  // Template Content
  clauseQuestions: ClauseQuestionSet[];
  standardAgendaItems: MeetingAgendaItem[];
  openingMeetingScript: string;
  closingMeetingScript: string;
  documentReviewChecklist: DocumentReviewItem[];
  inspectionChecklist: InspectionChecklistItem[];

  /** System default template. */
  isDefault: boolean;
  /** Shared across tenant. */
  isPublic: boolean;

  createdByUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
