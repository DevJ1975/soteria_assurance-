import type { Timestamp } from './common';

export interface WitnessQuestion {
  questionId: string;
  clauseReference: string;
  question: string;
  response: string;
  auditorNote?: string;
  /** Mark as key finding. */
  isKey: boolean;
}

/**
 * A recorded witness / interviewee statement captured during an audit.
 */
export interface WitnessStatement {
  id: string;
  auditId: string;
  tenantId: string;

  // Interviewee
  intervieweeName: string;
  intervieweeJobTitle: string;
  intervieweeDepartment: string;
  intervieweeEmployeeId?: string;

  // Interview Context
  clausesDiscussed: string[];
  interviewDate: Timestamp;
  /** Minutes. */
  interviewDuration: number;
  location: string;

  // Content
  questions: WitnessQuestion[];
  generalNotes: string;
  aiInterviewSummary?: string;

  // Recording
  audioRecordingUrl?: string;
  audioTranscription?: string;

  // Consent & Signature
  consentGiven: boolean;
  intervieweeSignatureUrl?: string;
  auditorSignatureUrl?: string;

  conductedByAuditorId: string;
  conductedByAuditorName: string;

  createdAt: Timestamp;
}
