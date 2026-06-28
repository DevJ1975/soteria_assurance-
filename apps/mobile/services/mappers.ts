/**
 * Mappers between WatermelonDB model rows and the canonical `@soteria/core`
 * domain types. Used by the sync manager to (a) build a Firestore payload from
 * a local row on push, and (b) hydrate a local row from a Firestore document on
 * pull.
 *
 * The `remoteId` on a local row IS the Firestore document `id`; a row created
 * offline has no `remoteId` yet, so the sync manager generates one before push.
 */
import type {
  Audit as AuditDoc,
  ClauseAssessment as ClauseDoc,
  Evidence as EvidenceDoc,
  Finding as FindingDoc,
} from '@soteria/core';
import type { Audit } from '../db/models/Audit';
import type { ClauseAssessment } from '../db/models/ClauseAssessment';
import type { Finding } from '../db/models/Finding';
import type { Evidence } from '../db/models/Evidence';
import { nowTimestamp, timestampFromMillis } from '../lib/timestamps';

// ---------------------------------------------------------------------------
// Local model  ->  Firestore document (@soteria/core type)
// ---------------------------------------------------------------------------

export function auditToDoc(model: Audit, remoteId: string): AuditDoc {
  const doc: AuditDoc = {
    id: remoteId,
    tenantId: model.tenantId,
    clientId: model.clientId,
    auditNumber: model.auditNumber,
    auditType: model.auditType,
    auditStage: model.auditStage,
    standard: 'ISO 45001:2018',
    scope: model.scope,
    status: model.status,
    leadAuditorId: model.leadAuditorId,
    auditTeam: model.auditTeam,
    managementRepresentativeName: model.managementRepresentativeName,
    plannedStartDate: model.plannedStartDate,
    plannedEndDate: model.plannedEndDate,
    auditDays: model.auditDays,
    sitesInScope: model.sitesInScope,
    auditPlan: model.auditPlan,
    findings: model.findingsSummary,
    confidentiality: model.confidentiality,
    createdAt: timestampFromMillis(model.localCreatedAt.getTime()),
    updatedAt: timestampFromMillis(model.localUpdatedAt.getTime()),
  };
  if (model.aiReadinessScore !== null) {
    doc.aiCertificationReadinessScore = model.aiReadinessScore;
  }
  if (model.aiRiskFlags !== null) {
    doc.aiRiskFlags = model.aiRiskFlags;
  }
  return doc;
}

export function clauseToDoc(model: ClauseAssessment, remoteId: string): ClauseDoc {
  const doc: ClauseDoc = {
    id: remoteId,
    auditId: model.auditId,
    tenantId: model.tenantId,
    clauseNumber: model.clauseNumber,
    clauseTitle: model.clauseTitle,
    assignedAuditorId: model.assignedAuditorId,
    conformityStatus: model.conformityStatus,
    score: model.score,
    auditorNotes: model.auditorNotes,
    evidenceIds: model.evidenceIds,
    findingIds: model.findingIds,
    subClauseNotes: model.subClauseNotes,
    isComplete: model.isComplete,
    updatedAt: timestampFromMillis(model.localUpdatedAt.getTime()),
  };
  if (model.aiGeneratedSummary !== null) {
    doc.aiGeneratedSummary = model.aiGeneratedSummary;
  }
  return doc;
}

export function findingToDoc(model: Finding, remoteId: string): FindingDoc {
  const doc: FindingDoc = {
    id: remoteId,
    auditId: model.auditId,
    tenantId: model.tenantId,
    clientId: model.clientId,
    findingNumber: model.findingNumber,
    type: model.type,
    clauseNumber: model.clauseNumber,
    clauseTitle: model.clauseTitle,
    requirement: model.requirement,
    title: model.title,
    objectiveEvidence: model.objectiveEvidence,
    nonconformityStatement: model.nonconformityStatement,
    evidenceIds: model.evidenceIds,
    raisedByAuditorId: model.raisedByAuditorId,
    raisedByAuditorName: model.raisedByAuditorName,
    raisedAt: timestampFromMillis(model.raisedAt.getTime()),
    status: model.status,
    updatedAt: timestampFromMillis(model.localUpdatedAt.getTime()),
  };
  if (model.severity !== null) doc.severity = model.severity;
  if (model.aiDraftStatement !== null) doc.aiDraftStatement = model.aiDraftStatement;
  if (model.department !== null) doc.department = model.department;
  if (model.area !== null) doc.area = model.area;
  if (model.targetClosureDate !== null) doc.targetClosureDate = model.targetClosureDate;
  return doc;
}

export function evidenceToDoc(model: Evidence, remoteId: string): EvidenceDoc {
  const doc: EvidenceDoc = {
    id: remoteId,
    auditId: model.auditId,
    tenantId: model.tenantId,
    type: model.type,
    title: model.title,
    description: model.description,
    fileUrl: model.fileUrl,
    fileName: model.fileName,
    fileSize: model.fileSize,
    mimeType: model.mimeType,
    capturedAt: timestampFromMillis(model.capturedAt.getTime()),
    capturedByAuditorId: model.capturedByAuditorId,
    clauseNumbers: model.clauseNumbers,
    findingIds: model.findingIds,
    isVerified: model.isVerified,
  };
  if (model.thumbnailUrl !== null) doc.thumbnailUrl = model.thumbnailUrl;
  if (model.geoLocation !== null) doc.geoLocation = model.geoLocation;
  return doc;
}

// ---------------------------------------------------------------------------
// Default-row factories (used when creating a fresh local audit context).
// ---------------------------------------------------------------------------

/** A zeroed findings summary for a brand-new audit. */
export function emptyFindingsSummary(): AuditDoc['findings'] {
  return {
    totalFindings: 0,
    majorNCs: 0,
    minorNCs: 0,
    ofis: 0,
    strongPoints: 0,
    observations: 0,
    closedNCs: 0,
    openNCs: 0,
  };
}

/** A `@soteria/core` Timestamp for "now" (re-exported for convenience). */
export { nowTimestamp };
