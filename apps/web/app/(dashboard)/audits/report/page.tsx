'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  SoteriaStrings,
  computeFindingsSummary,
  type Finding,
} from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FindingTypeBadge } from '@/components/FindingTypeBadge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { DownloadReportButton } from '@/components/DownloadReportButton';
import { useAudit, useFindings } from '@/lib/hooks';

function ReportView() {
  const params = useSearchParams();
  const auditId = params.get('id') ?? '';
  const auditQuery = useAudit(auditId);
  const findingsQuery = useFindings(auditId);

  // Recompute the summary from the live findings via the core scoring util
  // (RULE 4 — shared logic, never re-implemented locally).
  const summary = useMemo(
    () => computeFindingsSummary((findingsQuery.data ?? []) as Finding[]),
    [findingsQuery.data],
  );

  if (auditId === '') {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }
  if (auditQuery.isLoading || findingsQuery.isLoading) {
    return <LoadingState />;
  }
  if (auditQuery.isError) {
    return <ErrorState message={SoteriaStrings.errors.network} />;
  }
  const audit = auditQuery.data;
  if (audit === null || audit === undefined) {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-start justify-between gap-md">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">Audit report</h1>
          <p className="font-mono text-sm text-primary-700">{audit.auditNumber}</p>
        </div>
        <DownloadReportButton auditId={auditId} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Executive summary</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-sm text-sm">
          <p className="text-text-secondary">{audit.scope}</p>
          <div className="flex flex-wrap gap-sm">
            <Badge tone="major-nc">Major NCs: {summary.majorNCs}</Badge>
            <Badge tone="minor-nc">Minor NCs: {summary.minorNCs}</Badge>
            <Badge tone="ofi">OFIs: {summary.ofis}</Badge>
            <Badge tone="strong-point">Strong points: {summary.strongPoints}</Badge>
            <Badge tone="neutral">Total: {summary.totalFindings}</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{SoteriaStrings.findings.listTitle}</CardTitle>
        </CardHeader>
        <CardBody>
          {(findingsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">{SoteriaStrings.findings.noFindings}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {(findingsQuery.data ?? []).map((finding) => (
                <li key={finding.id} className="flex flex-col gap-1 py-2">
                  <span className="flex items-center gap-sm">
                    <FindingTypeBadge type={finding.type} />
                    <span className="font-mono text-xs text-primary-700">
                      {finding.findingNumber}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      {finding.clauseNumber}
                    </span>
                  </span>
                  <span className="text-sm text-text-primary">{finding.title}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReportView />
    </Suspense>
  );
}
