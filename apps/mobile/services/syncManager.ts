/**
 * Bidirectional offline sync manager (DESIGN_DOC §11).
 *
 * RULE 9 — every mutation is written to WatermelonDB first; this manager later
 * pushes the unsynced local rows to the tenant-scoped Firestore collections and
 * pulls remote changes back. UI actions NEVER await sync: call
 * {@link scheduleSync} (fire-and-forget) after a local write, or rely on the
 * connectivity-driven trigger registered in the root provider.
 *
 * RULE 2 — every Firestore reference is produced by the `@soteria/firebase`
 * tenant-scoped helpers (`auditsCol` / `findingsCol` / …); there is no raw
 * root-collection access anywhere here.
 */
import { Q } from '@nozbe/watermelondb';
import {
  auditsCol,
  clauseAssessmentsCol,
  evidenceCol,
  findingsCol,
  setDocById,
} from '@soteria/firebase';
import { database } from '../db';
import type { Audit } from '../db/models/Audit';
import type { ClauseAssessment } from '../db/models/ClauseAssessment';
import type { Finding } from '../db/models/Finding';
import type { Evidence } from '../db/models/Evidence';
import {
  TABLE_AUDITS,
  TABLE_CLAUSE_ASSESSMENTS,
  TABLE_EVIDENCE,
  TABLE_FINDINGS,
  type SyncStatus,
} from '../db/schema';
import { auditToDoc, clauseToDoc, evidenceToDoc, findingToDoc } from './mappers';
import { isOnline } from './offline';
import { useAuditStore } from '../stores/auditStore';

/** Result of a sync pass — surfaced to the store for the §11 indicator. */
export interface SyncResult {
  pushed: number;
  failed: number;
  skippedOffline: boolean;
}

const UNSYNCED = (): Q.Clause => Q.where('sync_status', Q.notEq<SyncStatus>('synced'));

/**
 * Generates a stable Firestore document id for a locally-created row.
 *
 * Lightweight and dependency-free; collision risk is negligible at per-tenant
 * scale and these ids are only ever used as Firestore document keys, assigned
 * once and then persisted back to the row's `remote_id`.
 */
function newRemoteId(): string {
  return `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Push: local -> Firestore
// ---------------------------------------------------------------------------

async function pushAudits(): Promise<{ pushed: number; failed: number }> {
  const rows = await database.collections
    .get<Audit>(TABLE_AUDITS)
    .query(UNSYNCED())
    .fetch();
  let pushed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const remoteId = row.remoteId ?? newRemoteId();
      await setDocById(auditsCol(row.tenantId), auditToDoc(row, remoteId));
      await markRowSynced(row, remoteId);
      pushed += 1;
    } catch {
      await markRowFailed(row);
      failed += 1;
    }
  }
  return { pushed, failed };
}

async function pushClauses(): Promise<{ pushed: number; failed: number }> {
  const rows = await database.collections
    .get<ClauseAssessment>(TABLE_CLAUSE_ASSESSMENTS)
    .query(UNSYNCED())
    .fetch();
  let pushed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const remoteId = row.remoteId ?? newRemoteId();
      await setDocById(
        clauseAssessmentsCol(row.tenantId, row.auditId),
        clauseToDoc(row, remoteId),
      );
      await markRowSynced(row, remoteId);
      pushed += 1;
    } catch {
      await markRowFailed(row);
      failed += 1;
    }
  }
  return { pushed, failed };
}

async function pushFindings(): Promise<{ pushed: number; failed: number }> {
  const rows = await database.collections
    .get<Finding>(TABLE_FINDINGS)
    .query(UNSYNCED())
    .fetch();
  let pushed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const remoteId = row.remoteId ?? newRemoteId();
      await setDocById(findingsCol(row.tenantId, row.auditId), findingToDoc(row, remoteId));
      await markRowSynced(row, remoteId);
      pushed += 1;
    } catch {
      await markRowFailed(row);
      failed += 1;
    }
  }
  return { pushed, failed };
}

async function pushEvidence(): Promise<{ pushed: number; failed: number }> {
  const rows = await database.collections
    .get<Evidence>(TABLE_EVIDENCE)
    .query(UNSYNCED())
    .fetch();
  let pushed = 0;
  let failed = 0;
  for (const row of rows) {
    // Evidence metadata only syncs once its binary has been uploaded; until then
    // the file URL is not a real Storage URL. The evidence service flips
    // `uploadStatus` to 'uploaded' after the background upload completes.
    if (row.uploadStatus !== 'uploaded') {
      continue;
    }
    try {
      const remoteId = row.remoteId ?? newRemoteId();
      await setDocById(evidenceCol(row.tenantId, row.auditId), evidenceToDoc(row, remoteId));
      await markRowSynced(row, remoteId);
      pushed += 1;
    } catch {
      await markRowFailed(row);
      failed += 1;
    }
  }
  return { pushed, failed };
}

type SyncableRow = Audit | ClauseAssessment | Finding | Evidence;

async function markRowSynced(row: SyncableRow, remoteId: string): Promise<void> {
  await database.write(async () => {
    await row.update((draft) => {
      draft.remoteId = remoteId;
      draft.syncStatus = 'synced';
    });
  });
}

async function markRowFailed(row: SyncableRow): Promise<void> {
  await database.write(async () => {
    await row.update((draft) => {
      draft.syncStatus = 'failed';
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Counts every local row not yet marked `synced` (drives §11 indicator). */
export async function countPendingChanges(): Promise<number> {
  const [a, c, f, e] = await Promise.all([
    database.collections.get<Audit>(TABLE_AUDITS).query(UNSYNCED()).fetchCount(),
    database.collections
      .get<ClauseAssessment>(TABLE_CLAUSE_ASSESSMENTS)
      .query(UNSYNCED())
      .fetchCount(),
    database.collections.get<Finding>(TABLE_FINDINGS).query(UNSYNCED()).fetchCount(),
    database.collections.get<Evidence>(TABLE_EVIDENCE).query(UNSYNCED()).fetchCount(),
  ]);
  return a + c + f + e;
}

/**
 * Runs one full push pass. Pull is intentionally a separate, on-demand call
 * (see {@link pullAudits}) so the field flow never blocks on a network read.
 *
 * Updates the audit store's §11 sync indicator as it progresses. Safe to call
 * fire-and-forget.
 */
export async function runSync(): Promise<SyncResult> {
  const store = useAuditStore.getState();

  if (!(await isOnline())) {
    store.setSyncIndicator('offline');
    return { pushed: 0, failed: 0, skippedOffline: true };
  }

  store.setSyncIndicator('syncing');

  const results = await Promise.all([
    pushAudits(),
    pushClauses(),
    pushFindings(),
    pushEvidence(),
  ]);

  const pushed = results.reduce((sum, r) => sum + r.pushed, 0);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);

  const remaining = await countPendingChanges();
  store.setPendingChanges(remaining);

  if (failed > 0) {
    store.setSyncError(`${failed} change(s) failed to sync.`);
  } else {
    store.markSynced(Date.now());
  }

  return { pushed, failed, skippedOffline: false };
}

/**
 * Fire-and-forget sync trigger for UI actions. Never throws into the caller —
 * a failed sync only updates the indicator (RULE 9: do not await sync in UI).
 */
export function scheduleSync(): void {
  void runSync().catch(() => {
    useAuditStore.getState().setSyncError('Background sync failed.');
  });
}

/**
 * Pull pass — load this tenant's audits from Firestore into the local DB. Used
 * on first launch / explicit refresh, not in the hot field-edit path.
 *
 * Records that already exist locally (matched by `remote_id`) are updated;
 * unseen records are inserted.
 */
export async function pullAudits(tenantId: string, leadAuditorId?: string): Promise<number> {
  const { getAuditsForTenant } = await import('@soteria/firebase');
  const remote = await getAuditsForTenant(tenantId, leadAuditorId);
  const collection = database.collections.get<Audit>(TABLE_AUDITS);

  await database.write(async () => {
    for (const doc of remote) {
      const existing = await collection
        .query(Q.where('remote_id', doc.id))
        .fetch();
      if (existing.length > 0 && existing[0] !== undefined) {
        const row = existing[0];
        await row.update((draft) => {
          applyAuditDoc(draft, doc);
        });
      } else {
        await collection.create((draft) => {
          draft.remoteId = doc.id;
          applyAuditDoc(draft, doc);
          draft.localCreatedAt = doc.createdAt.toDate();
        });
      }
    }
  });

  return remote.length;
}

function applyAuditDoc(
  draft: Audit,
  doc: Awaited<ReturnType<typeof import('@soteria/firebase')['getAuditsForTenant']>>[number],
): void {
  draft.tenantId = doc.tenantId;
  draft.clientId = doc.clientId;
  draft.auditNumber = doc.auditNumber;
  draft.auditType = doc.auditType;
  draft.auditStage = doc.auditStage;
  draft.standard = doc.standard;
  draft.scope = doc.scope;
  draft.status = doc.status;
  draft.leadAuditorId = doc.leadAuditorId;
  draft.managementRepresentativeName = doc.managementRepresentativeName;
  draft.plannedStartDate = doc.plannedStartDate;
  draft.plannedEndDate = doc.plannedEndDate;
  draft.auditDays = doc.auditDays;
  draft.confidentiality = doc.confidentiality;
  draft.aiReadinessScore = doc.aiCertificationReadinessScore ?? null;
  draft.auditTeam = doc.auditTeam;
  draft.sitesInScope = doc.sitesInScope;
  draft.auditPlan = doc.auditPlan;
  draft.findingsSummary = doc.findings;
  draft.aiRiskFlags = doc.aiRiskFlags ?? null;
  draft.syncStatus = 'synced';
  draft.localUpdatedAt = doc.updatedAt.toDate();
}
