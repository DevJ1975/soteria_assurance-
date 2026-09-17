'use client';

import { useState } from 'react';
import type { Audit, AuditStatus } from '@soteria/core';
import { SoteriaStrings } from '@soteria/core';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { useUpdateAudit } from '@/lib/hooks';

interface Transition {
  to: AuditStatus;
  label: string;
  /** Shown before an irreversible step. */
  confirm?: string;
  /** Extra columns this transition stamps. */
  extra?: () => Record<string, string | null>;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/**
 * Moves an audit through the ISO 19011 §6 lifecycle.
 *
 * WHY THIS EXISTS
 * No web code updated the `audits` table at all. `actual_start_date`,
 * `actual_end_date`, `completed_at` and `report_issued_at` were read by the
 * row mapper and written by nothing, and the only status transition in the
 * whole product was a mobile-side `in_progress` that could not sync. Every
 * audit therefore stayed `planned` for its entire life, and the audit register
 * showed a permanent list of planned audits with no evidence any of them had
 * been conducted or reported.
 *
 * Issuing the report is deliberately a one-way door with a confirmation: the
 * database's lifecycle-lock trigger freezes findings and clause assessments
 * once an audit reaches `report_issued`, so that the stored PDF and the live
 * record can never silently diverge.
 */
const TRANSITIONS: Partial<Record<AuditStatus, Transition[]>> = {
  planned: [
    {
      to: 'in_progress',
      label: 'Start audit',
      extra: () => ({ actualStartDate: TODAY() }),
    },
    { to: 'canceled', label: 'Cancel', confirm: 'Cancel this audit?' },
  ],
  in_progress: [
    {
      to: 'findings_review',
      label: 'Close fieldwork',
      extra: () => ({ actualEndDate: TODAY() }),
    },
  ],
  findings_review: [
    { to: 'report_pending', label: 'Approve findings' },
    { to: 'in_progress', label: 'Reopen fieldwork' },
  ],
  report_pending: [
    {
      to: 'report_issued',
      label: 'Issue report',
      confirm:
        'Issuing the report freezes every finding and clause assessment on this audit. '
        + 'Further changes will require a re-issue. Continue?',
      extra: () => ({ reportIssuedAt: new Date().toISOString() }),
    },
    { to: 'findings_review', label: 'Back to findings review' },
  ],
  report_issued: [
    {
      to: 'closed',
      label: 'Close audit',
      confirm: 'Close this audit? Corrective action follow-up should be complete.',
      extra: () => ({ completedAt: new Date().toISOString() }),
    },
  ],
};

export function AuditLifecycleControls({
  audit,
  openNCs,
}: {
  audit: Audit;
  openNCs: number;
}) {
  const updateAudit = useUpdateAudit();
  const [error, setError] = useState<string | null>(null);

  const available = TRANSITIONS[audit.status] ?? [];
  if (available.length === 0) {
    return null;
  }

  async function run(transition: Transition) {
    if (transition.confirm !== undefined && !window.confirm(transition.confirm)) {
      return;
    }
    setError(null);
    try {
      await updateAudit.mutateAsync({
        auditId: audit.id,
        patch: { status: transition.to, ...(transition.extra?.() ?? {}) },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  return (
    <div className="flex flex-col gap-sm rounded-md border border-border-soft bg-surface-muted p-md">
      <div className="flex flex-wrap items-center gap-sm">
        <span className="text-sm text-text-secondary">Audit lifecycle:</span>
        {available.map((transition) => (
          <Button
            key={transition.to}
            size="sm"
            variant={transition.to === 'canceled' ? 'secondary' : 'primary'}
            loading={updateAudit.isPending}
            onClick={() => run(transition)}
          >
            {transition.label}
          </Button>
        ))}
      </div>

      {/*
        Advisory, not a block. Under ISO/IEC 17021-1 a certification decision
        cannot be made with an unresolved major NC, but issuing the audit
        REPORT that documents those NCs is exactly what should happen — the
        report is how the auditee learns what to correct.
      */}
      {audit.status === 'report_pending' && openNCs > 0 ? (
        <p className="text-xs text-text-muted">
          {openNCs} nonconformit{openNCs === 1 ? 'y is' : 'ies are'} still open. The report
          will record them as open; certification cannot be granted until every major is
          closed and verified.
        </p>
      ) : null}

      {error !== null ? <ErrorState message={error} /> : null}
    </div>
  );
}
