'use client';

import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useCorrectiveActions } from '@/lib/hooks';
import { EffectivenessReview } from '@/components/EffectivenessReview';

export default function CorrectiveActionsPage() {
  const { data, isLoading, isError } = useCorrectiveActions();
  // targetDate is a date-only column; parsed as local midnight rather than
  // UTC so the badge doesn't flip up to a day early for any tenant west of
  // UTC, and compared against local midnight "today" rather than the exact
  // current instant.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = today.getTime();

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
        {SoteriaStrings.correctiveActions.listTitle}
      </h1>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message={SoteriaStrings.correctiveActions.noCorrectiveActions} />
      ) : (
        <div className="flex flex-col gap-md">
          {(data ?? []).map((ca) => {
            const target = new Date(`${ca.targetDate}T00:00:00`).getTime();
            // 'accepted' is terminal too, matching public.ca_is_open() on
            // the database side — not just 'closed', which nothing ever
            // actually writes.
            const overdue =
              ca.status !== 'accepted' &&
              ca.status !== 'closed' &&
              Number.isFinite(target) &&
              target < now;
            return (
              <Card key={ca.id}>
                <CardBody className="flex flex-col gap-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-primary-700">{ca.caNumber}</span>
                    {overdue ? (
                      <Badge tone="major-nc">{SoteriaStrings.findings.overdue}</Badge>
                    ) : (
                      <Badge tone="neutral">{ca.status.replace('_', ' ')}</Badge>
                    )}
                  </div>
                  <p className="font-medium text-text-primary">{ca.title}</p>
                  <p className="text-xs text-text-muted">
                    {SoteriaStrings.correctiveActions.targetDateLabel}: {ca.targetDate} ·{' '}
                    {ca.responsiblePersonName}
                  </p>
                  <EffectivenessReview correctiveAction={ca} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
