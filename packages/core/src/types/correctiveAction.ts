import type { Timestamp } from './common';
import type { CAStatus } from './finding';

export interface CAHistoryEntry {
  timestamp: Timestamp;
  action: string;
  performedBy: string;
  notes?: string;
}

export type RootCauseMethod = 'five_why' | '8d' | 'fishbone' | 'free_form';

/**
 * A corrective action (CAR) raised against a finding.
 */
export interface CorrectiveAction {
  id: string;
  tenantId: string;
  clientId: string;
  auditId: string;
  findingId: string;

  /** e.g. "CA-2026-001". */
  caNumber: string;
  title: string;

  // Root Cause Analysis
  rootCauseMethod: RootCauseMethod;
  rootCauseAnalysis: string;

  // Actions
  /** Containment action. */
  immediateAction: string;
  /** Systemic fix. */
  correctiveAction: string;
  /** Prevent recurrence. */
  preventiveAction: string;

  // Effectiveness
  effectivenessCheck: string;
  effectivenessCheckDate?: string;
  effectivenessResult?: 'effective' | 'not_effective';

  // Ownership
  responsiblePersonName: string;
  responsiblePersonEmail: string;

  // Timeline
  /** ISO date string. */
  targetDate: string;
  submittedDate?: string;
  reviewedDate?: string;
  closedDate?: string;

  // Evidence of Closure
  closureEvidenceIds: string[];
  closureNotes?: string;

  // Review
  reviewedByAuditorId?: string;
  reviewNotes?: string;

  status: CAStatus;
  aiRootCauseSuggestion?: string;

  history: CAHistoryEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
