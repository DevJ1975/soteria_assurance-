'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Plus } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import type { Audit } from '@soteria/core';
import { Card } from '@/components/ui/Card';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { useAudits, useCorrectiveActions } from '@/lib/hooks';
import { cn } from '@/lib/cn';

const ACTIVE_STATUSES: ReadonlyArray<Audit['status']> = [
  'planned',
  'in_progress',
  'findings_review',
  'report_pending',
];

/**
 * Headline stat card (FRAME 03). The big number uses JetBrains Mono per the
 * design system's "numbers/clause codes/NCR numbers" rule. `accent` switches the
 * card to the alert (red) treatment used by the "CAs Overdue" tile.
 */
interface StatCardProps {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  accent?: 'default' | 'alert';
}

function StatCard({ label, value, footer, accent = 'default' }: StatCardProps) {
  return (
    <Card className={cn('p-md', accent === 'alert' && 'border-major-nc/30')}>
      <p className="text-xs font-semibold tracking-wide text-text-secondary">{label}</p>
      <p
        className={cn(
          'mt-2 font-mono text-4xl font-bold leading-none',
          accent === 'alert' ? 'text-major-nc' : 'text-primary-800',
        )}
      >
        {value}
      </p>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </Card>
  );
}

/** Tinted, fully-rounded severity chip with a leading dot. */
function SeverityChip({
  count,
  label,
  className,
  dotClassName,
}: {
  count: number;
  label: string;
  className: string;
  dotClassName: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} />
      {count} {label}
    </span>
  );
}

/** Slim progress track using the canvas blue→teal gradient fill. */
function ProgressTrack({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border-track">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Circular certification-readiness gauge with a gold arc. */
function ReadinessGauge({ value }: { value: number | null }) {
  const r = 32;
  const circumference = 2 * Math.PI * r;
  const pct = value ?? 0;
  const dash = (pct / 100) * circumference;
  return (
    <div className="flex items-center gap-md">
      <div className="relative h-[78px] w-[78px] shrink-0">
        <svg width="78" height="78" viewBox="0 0 78 78" className="-rotate-90">
          <circle cx="39" cy="39" r={r} fill="none" stroke="#E3E8F0" strokeWidth="9" />
          {value !== null ? (
            <circle
              cx="39"
              cy="39"
              r={r}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-base font-bold text-primary-800">
          {value === null ? '—' : `${value}%`}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-text-secondary">
          {SoteriaStrings.audit.certificationReadiness}
        </p>
        <p className="mt-1 text-xs font-medium text-text-faint">Mean across scored audits</p>
      </div>
    </div>
  );
}

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
  const overdueCAList = correctiveActions.filter((ca) => {
    if (ca.status === 'closed') {
      return false;
    }
    const target = new Date(ca.targetDate).getTime();
    return Number.isFinite(target) && target < now;
  });
  const overdueCAs = overdueCAList.length;

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
      {/* Greeting + primary CTA */}
      <div className="flex flex-wrap items-end justify-between gap-md">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
            Dashboard
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
            <span>{activeAudits.length} active audits</span>
            <span className="text-[#C3CEDD]">•</span>
            <span>{openNCs} open NCs</span>
            {overdueCAs > 0 ? (
              <>
                <span className="text-[#C3CEDD]">•</span>
                <span className="font-semibold text-major-nc">{overdueCAs} CAs overdue</span>
              </>
            ) : null}
          </div>
        </div>
        <Link
          href="/audits"
          className="inline-flex h-10 shrink-0 items-center gap-sm rounded-md bg-primary-500 px-md text-sm font-semibold text-white shadow-cta-primary transition-colors hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {SoteriaStrings.audit.newAudit}
        </Link>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Audits"
          value={activeAudits.length}
          footer={
            <>
              <ProgressTrack
                pct={audits.length === 0 ? 0 : (activeAudits.length / audits.length) * 100}
              />
              <p className="mt-2 text-[11px] font-medium text-text-faint">
                {audits.length} total in tenant
              </p>
            </>
          }
        />
        <StatCard
          label="Open Nonconformities"
          value={openNCs}
          footer={
            <div className="flex flex-wrap gap-2">
              <SeverityChip
                count={openMajor}
                label="Major"
                className="bg-major-nc/10 text-major-nc"
                dotClassName="bg-major-nc"
              />
              <SeverityChip
                count={openMinor}
                label="Minor"
                className="bg-minor-nc/10 text-[#C2691C]"
                dotClassName="bg-minor-nc"
              />
            </div>
          }
        />
        <StatCard
          label="CAs Overdue"
          value={overdueCAs}
          accent="alert"
          footer={
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-major-nc">
              <Clock className="h-3 w-3" aria-hidden />
              {overdueCAs === 0 ? 'All on track' : 'Needs attention'}
            </div>
          }
        />
        <Card className="flex items-center p-md">
          <ReadinessGauge value={readiness} />
        </Card>
      </div>

      {/* Two-column: active audits + overdue CAs */}
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between px-lg pb-3 pt-md">
            <h2 className="font-display text-md font-bold text-primary-800">
              {SoteriaStrings.audit.listTitle}
            </h2>
            <Link
              href="/audits"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 hover:text-primary-600"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          {activeAudits.length === 0 ? (
            <p className="border-t border-[#EEF1F6] px-lg py-md text-sm text-text-secondary">
              {SoteriaStrings.audit.noAudits}
            </p>
          ) : (
            <ul>
              {activeAudits.slice(0, 5).map((audit) => {
                const total = audit.findings.totalFindings || 1;
                const pct = Math.round((audit.findings.closedNCs / total) * 100);
                return (
                  <li key={audit.id} className="border-t border-[#EEF1F6]">
                    <Link
                      href={`/audits/view?id=${encodeURIComponent(audit.id)}`}
                      className="flex items-center gap-md px-lg py-3 transition-colors hover:bg-background"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-800 font-display text-sm font-bold text-white">
                        {audit.managementRepresentativeName.slice(0, 2).toUpperCase() || 'AU'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {audit.scope}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] font-semibold text-gold-500">
                          {audit.auditNumber}
                        </p>
                      </div>
                      <div className="hidden w-28 shrink-0 sm:block">
                        <ProgressTrack pct={pct} />
                        <p className="mt-1 text-[10px] font-medium text-text-faint">
                          {audit.status.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-text-faint" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 px-lg pb-3 pt-md">
            <span className="h-1.5 w-1.5 rounded-full bg-major-nc" aria-hidden />
            <h2 className="font-display text-md font-bold text-primary-800">
              Overdue Corrective Actions
            </h2>
          </div>
          {overdueCAList.length === 0 ? (
            <p className="border-t border-[#EEF1F6] px-lg py-md text-sm text-text-secondary">
              No overdue corrective actions.
            </p>
          ) : (
            <ul>
              {overdueCAList.slice(0, 6).map((ca) => {
                const daysOver = Math.max(
                  0,
                  Math.round((now - new Date(ca.targetDate).getTime()) / 86_400_000),
                );
                return (
                  <li key={ca.id} className="border-t border-[#EEF1F6]">
                    <Link
                      href="/corrective-actions"
                      className="flex items-center gap-3 px-lg py-2.5 transition-colors hover:bg-background"
                    >
                      <span className="h-7 w-[3px] shrink-0 rounded-full bg-major-nc" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text-primary">
                          <span className="font-mono text-gold-500">{ca.caNumber}</span> · {ca.title}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-text-faint">
                          {ca.responsiblePersonName}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-major-nc/10 px-2.5 py-1 text-[10px] font-bold text-major-nc">
                        {daysOver}d overdue
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
