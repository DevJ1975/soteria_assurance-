'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SoteriaStrings, computeFindingsSummary, getStandard } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useAudit, useFindings } from '@/lib/hooks';
import { AuditLifecycleControls } from './AuditLifecycleControls';
import { MeetingRecord } from './MeetingRecord';
import { AuditPlanBuilder } from './AuditPlanBuilder';
import { EvidencePanel } from './EvidencePanel';
import { GovernancePanel } from './GovernancePanel';

function AuditView() {
  const params = useSearchParams();
  const auditId = params.get('id') ?? '';
  const { data: audit, isLoading, isError } = useAudit(auditId);
  const { data: findings } = useFindings(auditId);

  if (auditId === '') {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }
  if (isLoading) {
    return <LoadingState />;
  }
  if (isError) {
    return <ErrorState message={SoteriaStrings.errors.network} />;
  }
  if (audit === null || audit === undefined) {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }

  // Computed live from the findings, NOT read from `audits.findings`.
  // That denormalized jsonb column is written as all-zeros when the audit is
  // created and nothing ever recomputes it, so this card showed "Major: 0"
  // for an audit carrying twelve nonconformities. The report generator and the
  // dashboard already compute live; this screen and its mobile twin did not.
  const summary = computeFindingsSummary(findings ?? []);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="font-mono text-2xl font-bold text-primary-700">{audit.auditNumber}</h1>
          <p className="text-sm text-text-secondary">{getStandard(audit.standardId).name}</p>
        </div>
        <Badge tone="primary">{audit.status.replace('_', ' ')}</Badge>
      </div>

      <AuditLifecycleControls audit={audit} openNCs={summary.openNCs} />

      <div className="flex flex-wrap gap-sm">
        <Link href={`/audits/clauses?id=${encodeURIComponent(audit.id)}`}>
          <Badge tone="neutral">{SoteriaStrings.clauses.navigatorTitle}</Badge>
        </Link>
        <Link href={`/audits/findings?id=${encodeURIComponent(audit.id)}`}>
          <Badge tone="neutral">{SoteriaStrings.findings.listTitle}</Badge>
        </Link>
        <Link href={`/audits/report?id=${encodeURIComponent(audit.id)}`}>
          <Badge tone="neutral">Report</Badge>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-sm text-sm">
            <Row label={SoteriaStrings.audit.scopeLabel} value={audit.scope} />
            <Row label="Audit type" value={audit.auditType.replace('_', ' ')} />
            <Row label={SoteriaStrings.audit.plannedDatesLabel} value={`${audit.plannedStartDate} → ${audit.plannedEndDate}`} />
            <Row label="Management representative" value={audit.managementRepresentativeName} />
            <Row label="Confidentiality" value={audit.confidentiality} />
          </CardBody>
        </Card>

        <GovernancePanel audit={audit} />

        <AuditPlanBuilder audit={audit} />

        <MeetingRecord auditId={audit.id} findings={findings ?? []} />

        <EvidencePanel auditId={audit.id} />

        <Card>
          <CardHeader>
            <CardTitle>Findings summary</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-sm">
            <Badge tone="major-nc">Major: {summary.majorNCs}</Badge>
            <Badge tone="minor-nc">Minor: {summary.minorNCs}</Badge>
            <Badge tone="ofi">OFI: {summary.ofis}</Badge>
            <Badge tone="strong-point">SP: {summary.strongPoints}</Badge>
            <Badge tone="neutral">Open NCs: {summary.openNCs}</Badge>
            <Badge tone="conforming">Closed NCs: {summary.closedNCs}</Badge>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-md border-b border-border pb-1">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default function AuditViewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditView />
    </Suspense>
  );
}
