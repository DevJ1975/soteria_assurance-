/**
 * `onAuditComplete` Firestore trigger — recomputes a denormalised findings
 * summary when an audit transitions into a completed/report state.
 *
 * SOTERIA RULE 2 — the trigger path is tenant-scoped:
 * `tenants/{tenantId}/audits/{auditId}`. It reads the audit's `findings`
 * subcollection (also tenant-scoped) and writes back an aggregated
 * {@link AuditFindingsSummary}, never touching auditor-confirmed finding text.
 *
 * @packageDocumentation
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import type {
  Audit,
  AuditStatus,
  AuditFindingsSummary,
  Finding,
  FindingType,
  FindingStatus,
} from '@soteria/core';
import { getDb } from '../common/admin';

/** Statuses for which the summary should be (re)computed. */
const SUMMARY_TRIGGER_STATUSES: readonly AuditStatus[] = [
  'findings_review',
  'report_pending',
  'report_issued',
  'closed',
];

/**
 * Aggregates a list of findings into an {@link AuditFindingsSummary}. Pure +
 * exported for unit testing.
 */
export function summariseFindings(
  findings: ReadonlyArray<Pick<Finding, 'type' | 'status'>>,
): AuditFindingsSummary {
  const countByType = (type: FindingType): number =>
    findings.filter((f) => f.type === type).length;
  const closedStatuses: readonly FindingStatus[] = ['closed'];

  const majorNCs = countByType('major_nc');
  const minorNCs = countByType('minor_nc');
  const closedNCs = findings.filter(
    (f) =>
      (f.type === 'major_nc' || f.type === 'minor_nc') &&
      closedStatuses.includes(f.status),
  ).length;
  const openNCs = majorNCs + minorNCs - closedNCs;

  return {
    totalFindings: findings.length,
    majorNCs,
    minorNCs,
    ofis: countByType('ofi'),
    strongPoints: countByType('strong_point'),
    observations: countByType('observation'),
    closedNCs,
    openNCs,
  };
}

/**
 * Firestore trigger handler. Recomputes the summary on a qualifying status
 * change. Idempotent — safe to re-run on retries.
 */
export const onAuditComplete = onDocumentUpdated(
  'tenants/{tenantId}/audits/{auditId}',
  async (event) => {
    const before = event.data?.before.data() as Audit | undefined;
    const after = event.data?.after.data() as Audit | undefined;
    if (!before || !after) {
      return;
    }

    // Only act when the status actually changed into a summary-trigger state.
    const becameSummarisable =
      before.status !== after.status &&
      SUMMARY_TRIGGER_STATUSES.includes(after.status);
    if (!becameSummarisable) {
      return;
    }

    const { tenantId, auditId } = event.params;
    const db = getDb();
    const findingsSnap = await db
      .collection(`tenants/${tenantId}/audits/${auditId}/findings`)
      .get();

    const findings = findingsSnap.docs.map((doc) => {
      const data = doc.data() as Finding;
      return { type: data.type, status: data.status };
    });

    const summary = summariseFindings(findings);

    await db.doc(`tenants/${tenantId}/audits/${auditId}`).update({
      findings: summary,
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);
