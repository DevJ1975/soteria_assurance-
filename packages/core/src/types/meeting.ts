import type { Timestamp } from './common';
import type { AuditFindingsSummary } from './audit';

export interface MeetingAttendee {
  attendeeId: string;
  name: string;
  jobTitle: string;
  organization: string;
  role: 'auditor' | 'auditee' | 'observer';
  isPresent: boolean;
  signatureUrl?: string;
}

export interface MeetingAgendaItem {
  order: number;
  title: string;
  description?: string;
  durationMinutes: number;
  presenter: string;
  isoClauseReference?: string;
}

export interface MeetingActionItem {
  actionId: string;
  description: string;
  owner: string;
  dueDate?: string;
  isCompleted: boolean;
}

export interface MeetingSignature {
  signerName: string;
  signerTitle: string;
  signatureUrl: string;
  signedAt: Timestamp;
}

/**
 * An opening or closing audit meeting.
 */
export interface Meeting {
  id: string;
  auditId: string;
  tenantId: string;

  type: 'opening' | 'closing';
  scheduledAt: Timestamp;
  actualStartAt?: Timestamp;
  actualEndAt?: Timestamp;
  /** Seconds. */
  duration?: number;

  // Location
  /** e.g. "Conference Room A" or "Virtual - Teams". */
  location: string;
  isVirtual: boolean;
  virtualLink?: string;

  // Attendees
  attendees: MeetingAttendee[];

  // Agenda
  agendaItems: MeetingAgendaItem[];

  // Recording
  /** Firebase Storage URL. */
  recordingUrl?: string;
  /** Seconds. */
  recordingDuration?: number;
  /** Full AI-generated transcription. */
  transcription?: string;
  /** AI-generated meeting summary. */
  aiSummary?: string;
  /** AI-extracted key decisions. */
  keyDecisions?: string[];
  actionItems?: MeetingActionItem[];

  /** Presenter notes (for closing meetings). */
  findingsSummaryPresented?: AuditFindingsSummary;

  // Signatures
  signatureUrls: MeetingSignature[];

  status: 'scheduled' | 'in_progress' | 'completed' | 'canceled';
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
