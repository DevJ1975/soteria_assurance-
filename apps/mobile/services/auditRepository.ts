/**
 * Local-first write repository for audit data.
 *
 * RULE 9 — every mutation writes to WatermelonDB synchronously here, then
 * fire-and-forgets a background sync. Screens call these instead of touching
 * the database directly, so the offline-first contract is enforced in one place.
 */
import type {
  ConformityStatus,
  Finding as FindingDoc,
  FindingType,
  SubClauseNote,
} from '@soteria/core';
import { FINDING_TYPE_META, generateFindingNumber } from '@soteria/core';
import { database } from '../db';
import type { Audit } from '../db/models/Audit';
import type { ClauseAssessment } from '../db/models/ClauseAssessment';
import type { Finding } from '../db/models/Finding';
import {
  TABLE_AUDITS,
  TABLE_CLAUSE_ASSESSMENTS,
  TABLE_FINDINGS,
} from '../db/schema';
import { scheduleSync } from './syncManager';

// ---------------------------------------------------------------------------
// Clause assessments
// ---------------------------------------------------------------------------

export interface UpsertClauseInput {
  auditId: string;
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  assignedAuditorId: string;
  conformityStatus: ConformityStatus;
  score: number;
  auditorNotes: string;
  subClauseNotes: SubClauseNote[];
  isComplete: boolean;
}

/**
 * Creates or updates the clause assessment for `(auditId, clauseNumber)`,
 * marking it `pending` so the sync manager pushes it. Returns the row.
 */
export async function upsertClauseAssessment(
  input: UpsertClauseInput,
): Promise<ClauseAssessment> {
  const collection = database.collections.get<ClauseAssessment>(TABLE_CLAUSE_ASSESSMENTS);
  const { Q } = await import('@nozbe/watermelondb');
  const existing = await collection
    .query(Q.where('audit_id', input.auditId), Q.where('clause_number', input.clauseNumber))
    .fetch();

  let row!: ClauseAssessment;
  await database.write(async () => {
    const apply = (draft: ClauseAssessment): void => {
      draft.auditId = input.auditId;
      draft.tenantId = input.tenantId;
      draft.clauseNumber = input.clauseNumber;
      draft.clauseTitle = input.clauseTitle;
      draft.assignedAuditorId = input.assignedAuditorId;
      draft.conformityStatus = input.conformityStatus;
      draft.score = input.score;
      draft.auditorNotes = input.auditorNotes;
      draft.subClauseNotes = input.subClauseNotes;
      draft.isComplete = input.isComplete;
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = new Date();
    };

    if (existing.length > 0 && existing[0] !== undefined) {
      row = existing[0];
      await row.update(apply);
    } else {
      row = await collection.create((draft) => {
        draft.remoteId = null;
        draft.aiGeneratedSummary = null;
        draft.evidenceIds = [];
        draft.findingIds = [];
        apply(draft);
      });
    }
  });

  scheduleSync();
  return row;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export interface CreateFindingInput {
  auditId: string;
  tenantId: string;
  clientId: string;
  type: FindingType;
  clauseNumber: string;
  clauseTitle: string;
  requirement: string;
  title: string;
  objectiveEvidence: string;
  nonconformityStatement: string;
  aiDraftStatement?: string;
  department?: string;
  area?: string;
  raisedByAuditorId: string;
  raisedByAuditorName: string;
  /** Used to build the sequential finding number (e.g. NCR-2026-007). */
  sequence: number;
  /** Used to compute the mandatory target closure date for NCs. */
  ncrPrefix?: string;
}

/** Resolve the finding's severity from its type (NCs carry a severity). */
function severityFor(type: FindingType): 'major' | 'minor' | null {
  if (type === 'major_nc') return 'major';
  if (type === 'minor_nc') return 'minor';
  return null;
}

/** Compute the target closure date (ISO) from the type's mandatory CA window. */
function targetClosureFor(type: FindingType, raisedAt: Date): string | null {
  const days = FINDING_TYPE_META[type].correctiveActionDays;
  if (days === null) return null;
  const due = new Date(raisedAt);
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

/** Creates a finding locally (offline-first) and schedules a background sync. */
export async function createFinding(input: CreateFindingInput): Promise<Finding> {
  const collection = database.collections.get<Finding>(TABLE_FINDINGS);
  const now = new Date();
  const year = now.getFullYear();
  // Prefix from the type's audit code (e.g. MNC/NC/OFI), overridable per-tenant.
  const prefix = input.ncrPrefix ?? FINDING_TYPE_META[input.type].code;
  const findingNumber = generateFindingNumber(prefix, year, input.sequence);

  let row!: Finding;
  await database.write(async () => {
    row = await collection.create((draft) => {
      draft.remoteId = null;
      draft.auditId = input.auditId;
      draft.tenantId = input.tenantId;
      draft.clientId = input.clientId;
      draft.findingNumber = findingNumber;
      draft.type = input.type;
      draft.severity = severityFor(input.type);
      draft.clauseNumber = input.clauseNumber;
      draft.clauseTitle = input.clauseTitle;
      draft.requirement = input.requirement;
      draft.title = input.title;
      draft.objectiveEvidence = input.objectiveEvidence;
      draft.nonconformityStatement = input.nonconformityStatement;
      draft.aiDraftStatement = input.aiDraftStatement ?? null;
      draft.department = input.department ?? null;
      draft.area = input.area ?? null;
      draft.evidenceIds = [];
      draft.raisedByAuditorId = input.raisedByAuditorId;
      draft.raisedByAuditorName = input.raisedByAuditorName;
      draft.raisedAt = now;
      draft.targetClosureDate = targetClosureFor(input.type, now);
      draft.status = 'open';
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = now;
    });
  });

  scheduleSync();
  return row;
}

/** Update a finding's lifecycle status (acknowledge / close), then sync. */
export async function setFindingStatus(
  row: Finding,
  status: FindingDoc['status'],
): Promise<void> {
  await database.write(async () => {
    await row.update((draft) => {
      draft.status = status;
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = new Date();
    });
  });
  scheduleSync();
}

// ---------------------------------------------------------------------------
// Audit status
// ---------------------------------------------------------------------------

/** Transition an audit's status (e.g. start / complete), then sync. */
export async function setAuditStatus(
  row: Audit,
  status: Audit['status'],
): Promise<void> {
  await database.write(async () => {
    await row.update((draft) => {
      draft.status = status;
      draft.syncStatus = 'pending';
      draft.localUpdatedAt = new Date();
    });
  });
  scheduleSync();
}

export { TABLE_AUDITS };
