import type { Timestamp } from '../types/common';
import type { Finding, FindingType, FindingStatus } from '../types/finding';
import type { ClauseAssessment, ConformityStatus, SubClauseNote } from '../types/clause';

/**
 * Builds a structural {@link Timestamp} from a {@link Date} for use in tests.
 */
export function ts(date: Date): Timestamp {
  const millis = date.getTime();
  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1e6,
    toDate: () => new Date(millis),
    toMillis: () => millis,
  };
}

const EPOCH = ts(new Date('2026-01-01T00:00:00Z'));

/**
 * Builds a minimal valid {@link Finding} with overridable fields for tests.
 */
export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  const type: FindingType = overrides.type ?? 'minor_nc';
  const status: FindingStatus = overrides.status ?? 'open';
  const base: Finding = {
    id: 'finding-1',
    auditId: 'audit-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    findingNumber: 'NCR-2026-001',
    type,
    clauseNumber: '6.1.2',
    clauseTitle: 'Hazard identification and assessment of OH&S risks',
    requirement: 'The organization shall establish processes for hazard identification.',
    title: 'Incomplete hazard identification',
    objectiveEvidence: 'Risk register did not include the chemical store.',
    nonconformityStatement: '',
    evidenceIds: [],
    raisedByAuditorId: 'auditor-1',
    raisedByAuditorName: 'Jane Auditor',
    raisedAt: EPOCH,
    status,
    updatedAt: EPOCH,
  };
  return { ...base, ...overrides };
}

/**
 * Builds a minimal valid {@link ClauseAssessment} for tests.
 */
export function makeClauseAssessment(
  overrides: Partial<ClauseAssessment> = {},
): ClauseAssessment {
  const conformityStatus: ConformityStatus =
    overrides.conformityStatus ?? 'conforming';
  const base: ClauseAssessment = {
    id: 'clause-1',
    auditId: 'audit-1',
    tenantId: 'tenant-1',
    clauseNumber: '4.1',
    clauseTitle: 'Understanding the organization and its context',
    assignedAuditorId: 'auditor-1',
    conformityStatus,
    score: 100,
    auditorNotes: '',
    evidenceIds: [],
    findingIds: [],
    subClauseNotes: [],
    isComplete: true,
    updatedAt: EPOCH,
  };
  return { ...base, ...overrides };
}

/**
 * Builds a {@link SubClauseNote} for tests.
 */
export function makeSubClauseNote(
  verdict: SubClauseNote['conformityVerdict'],
  overrides: Partial<SubClauseNote> = {},
): SubClauseNote {
  return {
    subClauseNumber: '6.1.2.a',
    requirementText: 'Hazards shall be identified on an ongoing basis.',
    auditQuestion: 'How are hazards identified?',
    auditorResponse: 'Via routine inspections.',
    conformityVerdict: verdict,
    ...overrides,
  };
}
