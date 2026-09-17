import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

export type AuditType =
  | 'initial_certification'
  | 'surveillance'
  | 'recertification'
  | 'internal'
  | 'special';

export type AuditStage = 'stage_1' | 'stage_2' | 'not_applicable';

export type AuditStatus =
  | 'planned'
  | 'in_progress'
  | 'findings_review'
  | 'report_pending'
  | 'report_issued'
  | 'closed'
  | 'canceled';

/**
 * Aggregated counts of findings for an audit.
 */
export interface AuditFindingsSummary {
  totalFindings: number;
  majorNCs: number;
  minorNCs: number;
  ofis: number;
  strongPoints: number;
  observations: number;
  closedNCs: number;
  openNCs: number;
}

export interface AuditTeamMember {
  userId: string;
  displayName: string;
  role: 'lead_auditor' | 'auditor' | 'technical_expert' | 'observer';
  /** Clause IDs assigned to this auditor. */
  clauseAssignments: string[];
}

export interface AuditPlanActivity {
  activityId: string;
  time: string;
  /** Minutes. */
  duration: number;
  activity: string;
  /** ISO clause references. */
  clauses: string[];
  location: string;
  auditorIds: string[];
  intervieweeIds: string[];
}

export interface AuditInterviewee {
  intervieweeId: string;
  name: string;
  jobTitle: string;
  department: string;
  /** Topics to be discussed. */
  topics: string[];
  scheduledTime?: string;
}

export interface AuditInspectionArea {
  areaId: string;
  /** e.g. "Machine Shop", "Chemical Store". */
  name: string;
  hazards: string[];
  clauses: string[];
  scheduledTime?: string;
}

export interface AuditPlan {
  activities: AuditPlanActivity[];
  documentReviewList: string[];
  intervieweeList: AuditInterviewee[];
  areaInspectionList: AuditInspectionArea[];
}

export interface Audit {
  id: string;
  tenantId: string;
  /**
   * The certification cycle this audit belongs to. Optional for `internal`
   * and `special` audits; expected for initial certification, surveillance
   * and recertification so the cycle is traceable end to end.
   */
  programmeId?: string;
  clientId: string;
  /** Auto-generated, e.g. "AUD-2026-001". */
  auditNumber: string;
  auditType: AuditType;
  /** Stage 1 or Stage 2 (for certification). */
  auditStage: AuditStage;
  /** The management-system standard this audit is conducted against. */
  standardId: StandardId;
  /** Scope of the management system, in the standard's discipline. */
  scope: string;
  status: AuditStatus;

  // Audit Team
  leadAuditorId: string;
  auditTeam: AuditTeamMember[];

  // Client Representatives
  managementRepresentativeId?: string;
  managementRepresentativeName: string;

  // Scheduling
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  auditDays: number;

  /** Array of {@link ClientSite.siteId}. */
  sitesInScope: string[];

  // Planning
  auditPlan: AuditPlan;

  /** Aggregated findings summary. */
  findings: AuditFindingsSummary;

  // AI Assessment
  /** 0-100. */
  aiCertificationReadinessScore?: number;
  aiRiskFlags?: string[];

  // Metadata
  confidentiality: 'standard' | 'restricted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  reportIssuedAt?: Timestamp;
}
