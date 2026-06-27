'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ClipboardCheck, ShieldAlert, TrendingUp } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import type { Audit } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { useAudits, useCorrectiveActions } from '@/lib/hooks';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'primary' | 'major-nc' | 'warning' | 'conforming';
}

function StatCard({ label, value, icon, tone = 'primary' }: StatCardProps) {
  const toneClass =
    tone === 'major-nc'
      ? 'text-major-nc'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'conforming'
          ? 'text-conforming'
          : 'text-primary-600';
  return (
    <Card>
      <CardBody className="flex items-center gap-md">
        <div className={`rounded-md bg-background p-2 ${toneClass}`}>{icon}</div>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
          <p className="font-display text-2xl font-bold text-text-primary">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

const ACTIVE_STATUSES: ReadonlyArray<Audit['status']> = [
  'planned',
  'in_progress',
  'findings_review',
  'report_pending',
];

export default function DashboardPage() {
  const auditsQuery = useAudits();
  const caQuery = useCorrectiveActions();

  if (auditsQuery.isLoading || caQuery.isLoading) {
    return <LoadingState />;
  }
  if (auditsQuery.isError) {
    return <ErrorState message={SoteriaStrings.errors.network} />;
  }

  const audits = auditsQuery.data ?? [];
  const correctiveActions = caQuery.data ?? [];

  const activeAudits = audits.filter((a) => ACTIVE_STATUSES.includes(a.status));

  // Aggregate open NCs by severity from each audit's findings summary.
  let openMajor = 0;
  let openMinor = 0;
  for (const audit of audits) {
    openMajor += audit.findings.majorNCs;
    openMinor += audit.findings.minorNCs;
  }
  const openNCs = audits.reduce((sum, a) => sum + a.findings.openNCs, 0);

  // Overdue corrective actions: target date in the past and not closed.
  const now = Date.now();
  const overdueCAs = correctiveActions.filter((ca) => {
    if (ca.status === 'closed') {
      return false;
    }
    const target = new Date(ca.targetDate).getTime();
    return Number.isFinite(target) && target < now;
  }).length;

  // Mean certification-readiness across audits that carry an AI score.
  const scored = audits.filter(
    (a): a is Audit & { aiCertificationReadinessScore: number } =>
      typeof a.aiCertificationReadinessScore === 'number',
  );
  const readiness =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, a) => sum + a.aiCertificationReadinessScore, 0) / scored.length,
        )
      : null;

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary">{SoteriaStrings.common.appName}</p>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active audits"
          value={activeAudits.length}
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Open NCs"
          value={openNCs}
          tone="major-nc"
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label="Overdue CAs"
          value={overdueCAs}
          tone="warning"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          label={SoteriaStrings.audit.certificationReadiness}
          value={readiness === null ? '—' : `${readiness}%`}
          tone="conforming"
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Open NCs by severity</h2>
            </div>
            <div className="flex gap-md">
              <Badge tone="major-nc">Major: {openMajor}</Badge>
              <Badge tone="minor-nc">Minor: {openMinor}</Badge>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-sm">
            <h2 className="font-display text-lg font-semibold">{SoteriaStrings.audit.listTitle}</h2>
            {activeAudits.length === 0 ? (
              <p className="text-sm text-text-secondary">{SoteriaStrings.audit.noAudits}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {activeAudits.slice(0, 5).map((audit) => (
                  <li key={audit.id} className="py-2">
                    <Link
                      href={`/audits/view?id=${encodeURIComponent(audit.id)}`}
                      className="flex items-center justify-between hover:underline"
                    >
                      <span className="font-mono text-sm text-text-primary">
                        {audit.auditNumber}
                      </span>
                      <Badge tone="primary">{audit.status.replace('_', ' ')}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
