/**
 * Bidirectional offline sync manager (DESIGN_DOC §11).
 *
 * RULE 9 — every mutation is written to WatermelonDB first; this manager later
 * pushes the unsynced local rows to Supabase and pulls remote changes back. UI
 * actions NEVER await sync: call {@link scheduleSync} (fire-and-forget) after a
 * local write, or rely on the connectivity-driven trigger in the root provider.
 *
 * RULE 2 — tenant scoping is enforced by RLS on every table, and each row
 * carries its own `tenant_id`; there is no unscoped write anywhere here.
 *
 * Rows created offline have no server id. Rather than minting one on the
 * device — the Firebase implementation generated `loc_…` strings, which are
 * not valid uuids and would be rejected by Postgres — the first push inserts
 * without an id and stores the uuid the database returns in `remote_id`. Every
 * later push upserts on that id.
 */
import { Model, Q } from '@nozbe/watermelondb';
import { supabase } from '../lib/supabase';
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

} from '../db/schema';
import {
  auditToRow,
  clauseToRow,
  emptyFindingsSummary,
  evidenceToRow,
  findingToRow,
} from './mappers';
import { isOnline } from './offline';
import { useAuditStore } from '../stores/auditStore';

/** Result of a sync pass — surfaced to the store for the §11 indicator. */
export interface SyncResult {
  pushed: number;
  failed: number;
  skippedOffline: boolean;
}

const UNSYNCED = (): Q.Clause => Q.where('sync_status', Q.notEq('synced'));


// ---------------------------------------------------------------------------
// Push: local -> Supabase
// ---------------------------------------------------------------------------

/**
 * Pushes one table's unsynced rows.
 *
 * The four tables differed only in their mapper and target, so they share one
 * implementation. Rows are pushed individually rather than in a batch: a
 * single malformed row should not block the rest of an auditor's day of work
 * from reaching the server, and each row's own sync state records what
 * happened to it.
 */
/**
 * Resolves the server-side uuid for the audit a child row belongs to.
 *
 * WHY THIS IS NECESSARY
 * Route params carry the LOCAL WatermelonDB id (a 16-character alphanumeric),
 * and that value flowed unchanged into `audit_id` — a `uuid NOT NULL REFERENCES
 * public.audits(id)`. Postgres rejected every such insert, `pushTable` caught
 * the error and marked the row failed, and it retried forever. A full day of
 * site work stayed on one device with a bare failure count as the only signal.
 *
 * Returns null when the parent audit has not itself synced yet, which is not
 * an error: the child simply waits for the next pass.
 */
async function resolveAuditRemoteId(localAuditId: string): Promise<string | null> {
  if (localAuditId === '') return null;
  // Already a server uuid (e.g. the row came from a pull) — nothing to map.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localAuditId)) {
    return localAuditId;
  }
  const parent = await database.collections
    .get<Audit>(TABLE_AUDITS)
    .query(Q.where('id', localAuditId))
    .fetch();
  return parent[0]?.remoteId ?? null;
}

async function pushTable<T extends Model & SyncableRow>(
  table: string,
  remoteTable: string,
  toRow: (model: T, auditRemoteId: string) => Record<string, unknown>,
  options: { only?: (model: T) => boolean; auditIdOf?: (model: T) => string } = {},
): Promise<{ pushed: number; failed: number; deferred: number }> {
  const rows = await database.collections.get<T>(table).query(UNSYNCED()).fetch();
  let pushed = 0;
  let failed = 0;
  let deferred = 0;

  for (const row of rows) {
    if (options.only && !options.only(row)) continue;
    try {
      // A child row whose parent audit has not synced has no valid foreign key
      // to send. Leave it pending rather than pushing a value Postgres will
      // reject — a deferred row is recoverable, a failed one accrues retries.
      let auditRemoteId = '';
      if (options.auditIdOf !== undefined) {
        const resolved = await resolveAuditRemoteId(options.auditIdOf(row));
        if (resolved === null) {
          deferred += 1;
          continue;
        }
        auditRemoteId = resolved;
      }
      const payload = toRow(row, auditRemoteId);
      const { data, error } = await supabase
        .from(remoteTable)
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .single();
      if (error) throw error;
      await markRowSynced(row, data.id as string);
      pushed += 1;
    } catch (error) {
      await markRowFailed(row, error);
      failed += 1;
    }
  }
  return { pushed, failed, deferred };
}

async function pushAudits(): Promise<{ pushed: number; failed: number; deferred: number }> {
  return pushTable<Audit>(TABLE_AUDITS, 'audits', auditToRow);
}

async function pushClauses(): Promise<{ pushed: number; failed: number; deferred: number }> {
  return pushTable<ClauseAssessment>(
    TABLE_CLAUSE_ASSESSMENTS,
    'clause_assessments',
    clauseToRow,
    { auditIdOf: (row) => row.auditId },
  );
}

async function pushFindings(): Promise<{ pushed: number; failed: number; deferred: number }> {
  return pushTable<Finding>(TABLE_FINDINGS, 'findings', findingToRow, {
    auditIdOf: (row) => row.auditId,
  });
}

async function pushEvidence(): Promise<{ pushed: number; failed: number; deferred: number }> {
  // Metadata only syncs once the binary is in the bucket; until then
  // `storage_path` would point at nothing. The evidence service flips
  // `uploadStatus` to 'uploaded' when the background upload finishes.
  return pushTable<Evidence>(TABLE_EVIDENCE, 'evidence', evidenceToRow, {
    only: (row) => row.uploadStatus === 'uploaded',
    auditIdOf: (row) => row.auditId,
  });
}

type SyncableRow = Audit | ClauseAssessment | Finding | Evidence;

async function markRowSynced(row: SyncableRow, remoteId: string): Promise<void> {
  await database.write(async () => {
    await row.update((draft) => {
      draft.remoteId = remoteId;
      draft.uploadState = 'synced';
    });
  });
}

async function markRowFailed(row: SyncableRow, error?: unknown): Promise<void> {
  // The reason is logged rather than discarded: a bare failure count gives an
  // auditor whose whole day failed to sync no way to identify or diagnose it.
  if (error !== undefined) {
    console.warn('[sync] row failed to push', {
      table: row.table,
      id: row.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  await database.write(async () => {
    await row.update((draft) => {
      draft.uploadState = 'failed';
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

  // Audits FIRST, and awaited, so their server ids exist before any child row
  // tries to resolve its foreign key. Running these in parallel would defer
  // every child on a first sync.
  const auditResult = await pushAudits();
  const childResults = await Promise.all([pushClauses(), pushFindings(), pushEvidence()]);
  const results = [auditResult, ...childResults];

  const pushed = results.reduce((sum, r) => sum + r.pushed, 0);
  const failed = results.reduce((sum, r) => sum + r.failed, 0);
  const deferred = results.reduce((sum, r) => sum + r.deferred, 0);

  const remaining = await countPendingChanges();
  store.setPendingChanges(remaining);

  if (failed > 0) {
    store.setSyncError(`${failed} change(s) failed to sync. See the log for the reason.`);
  } else if (deferred > 0) {
    // Not an error: these are waiting on their parent audit and will go on the
    // next pass. Saying "failed" here would send an auditor hunting a problem
    // that resolves itself.
    store.setSyncError(`${deferred} change(s) waiting for their audit to sync.`);
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
 * Pull pass — load this tenant's audits from Supabase into the local database.
 * Used on first launch and explicit refresh, not in the hot field-edit path.
 *
 * Records already present locally (matched on `remote_id`) are updated; unseen
 * ones are inserted. Local edits are not overwritten selectively — a row the
 * auditor has changed is still pending push, and the next push wins, because
 * work captured on site is the thing that must not be lost.
 */
export async function pullAudits(tenantId: string, leadAuditorId?: string): Promise<number> {
  let request = supabase
    .from('audits')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('planned_start_date', { ascending: false });
  if (leadAuditorId) request = request.eq('lead_auditor_id', leadAuditorId);

  const { data, error } = await request;
  if (error) throw error;
  const remote = data ?? [];
  const collection = database.collections.get<Audit>(TABLE_AUDITS);

  await database.write(async () => {
    for (const row of remote) {
      const existing = await collection.query(Q.where('remote_id', row.id as string)).fetch();
      const first = existing[0];
      if (first !== undefined) {
        // A row the auditor has changed is still pending push. Overwriting it
        // here and then setting uploadState = 'synced' (which applyAuditRow
        // does) would discard the edit AND clear the flag that would have sent
        // it, so the work would be unrecoverable. Field capture wins; the
        // pending push carries it to the server on the next pass.
        if (first.uploadState !== 'synced') {
          continue;
        }
        await first.update((draft) => {
          applyAuditRow(draft, row);
        });
      } else {
        await collection.create((draft) => {
          draft.remoteId = row.id as string;
          applyAuditRow(draft, row);
        });
      }
    }
  });

  return remote.length;
}

/** Copies a Supabase `audits` row onto a local model draft. */
function applyAuditRow(draft: Audit, row: Record<string, unknown>): void {
  draft.tenantId = row.tenant_id as string;
  draft.clientId = row.client_id as string;
  draft.auditNumber = row.audit_number as string;
  draft.auditType = row.audit_type as Audit['auditType'];
  draft.auditStage = row.audit_stage as Audit['auditStage'];
  draft.standard = (row.standard_id as string) ?? 'iso45001';
  draft.scope = (row.scope as string) ?? '';
  draft.status = row.status as Audit['status'];
  draft.leadAuditorId = (row.lead_auditor_id as string | null) ?? '';
  draft.managementRepresentativeName = (row.management_representative_name as string) ?? '';
  draft.plannedStartDate = (row.planned_start_date as string) ?? '';
  draft.plannedEndDate = (row.planned_end_date as string) ?? '';
  draft.auditDays = Number(row.audit_days ?? 1);
  draft.confidentiality = (row.confidentiality as Audit['confidentiality']) ?? 'standard';
  draft.aiReadinessScore = (row.ai_certification_readiness_score as number | null) ?? null;
  draft.auditTeam = (row.audit_team as Audit['auditTeam']) ?? [];
  draft.sitesInScope = (row.sites_in_scope as string[]) ?? [];
  draft.auditPlan = (row.audit_plan as Audit['auditPlan']) ?? ({} as Audit['auditPlan']);
  draft.findingsSummary =
    (row.findings as Audit['findingsSummary']) ?? emptyFindingsSummary();
  draft.aiRiskFlags = (row.ai_risk_flags as string[]) ?? [];
  // Pulled rows are already on the server, so they start clean.
  draft.uploadState = 'synced';
  draft.localUpdatedAt = new Date();
}

