'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useCorrectiveActions, useSubmitCorrectiveAction } from '@/lib/hooks';
import { useRealtimeCorrectiveActions } from '@/lib/realtime';
import { LiveIndicator } from '@/components/LiveIndicator';
import { useAuth } from '@/lib/auth-context';
import { EffectivenessReview } from '@/components/EffectivenessReview';
import { RaiseCorrectiveActionForm } from './RaiseCorrectiveActionForm';

export default function CorrectiveActionsPage() {
  const { data, isLoading, isError } = useCorrectiveActions();
  const { user } = useAuth();
  const submitCA = useSubmitCorrectiveAction();
  const liveStatus = useRealtimeCorrectiveActions();
  const [raising, setRaising] = useState(false);
  // targetDate is a date-only column; parsed as local midnight rather than
  // UTC so the badge doesn't flip up to a day early for any tenant west of
  // UTC, and compared against local midnight "today" rather than the exact
  // current instant.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = today.getTime();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-md">
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
            {SoteriaStrings.correctiveActions.listTitle}
          </h1>
          {/* An auditee submits and an auditor reviews from two different
              screens; without this the reviewer works from a stale status. */}
          <LiveIndicator status={liveStatus} />
        </div>
        {raising ? null : (
          <Button onClick={() => setRaising(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Raise corrective action
          </Button>
        )}
      </div>

      {raising ? <RaiseCorrectiveActionForm onClose={() => setRaising(false)} /> : null}

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
                  {/*
                    A raised CA sits at `pending` until the responsible person
                    submits their plan. `record_effectiveness_review` refuses
                    anything not already submitted/accepted/rejected, so
                    without this step the review below can never run.
                  */}
                  {ca.status === 'pending' || ca.status === 'in_progress' ? (
                    <div className="flex items-center justify-between gap-sm rounded-md border border-border-soft bg-surface-muted p-sm">
                      <span className="text-xs text-text-secondary">
                        Awaiting submission of the root cause analysis and action plan.
                      </span>
                      <Button
                        size="sm"
                        loading={submitCA.isPending}
                        onClick={() =>
                          submitCA.mutate({
                            caId: ca.id,
                            submittedBy: user?.email ?? 'Unknown',
                          })
                        }
                      >
                        Submit for review
                      </Button>
                    </div>
                  ) : (
                    <EffectivenessReview correctiveAction={ca} />
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
