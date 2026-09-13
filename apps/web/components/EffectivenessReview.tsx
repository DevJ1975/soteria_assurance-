'use client';

import { useState } from 'react';
import type { CorrectiveAction } from '@soteria/core';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { useRecordEffectivenessReview } from '@/lib/hooks';

/**
 * The effectiveness review of a corrective action.
 *
 * ISO 45001 closure is not "the work was done" — it is an auditor judging,
 * on a date, whether the action actually removed the cause. So the two
 * outcomes are deliberately not symmetrical: accepting closes the action and
 * the finding behind it, rejecting reopens the action for the responsible
 * person and restarts its escalation clock.
 *
 * A result statement is required for both. "Rejected" with no reason is not a
 * reviewable audit record.
 */
export function EffectivenessReview({ correctiveAction }: { correctiveAction: CorrectiveAction }) {
  const review = useRecordEffectivenessReview();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');

  // A submitted or previously-rejected action can be reviewed; an accepted
  // one is closed and stays closed — the database enforces this too, so the
  // UI simply does not offer it rather than failing on submit.
  const reviewable =
    correctiveAction.status === 'submitted' || correctiveAction.status === 'rejected';
  if (!reviewable) return null;

  function submit(effective: boolean) {
    if (result.trim() === '') return;
    review.mutate(
      { correctiveActionId: correctiveAction.id, effective, result: result.trim() },
      { onSuccess: () => { setResult(''); setOpen(false); } },
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Review effectiveness
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border-soft bg-background p-md">
      <label htmlFor={`review-${correctiveAction.id}`} className="text-sm font-medium text-text-primary">
        What did you verify?
      </label>
      <Textarea
        id={`review-${correctiveAction.id}`}
        value={result}
        onChange={(event) => setResult(event.target.value)}
        placeholder="e.g. Re-inspected the line on 12 Sep; guard fitted and the permit updated."
        rows={3}
      />
      {review.error ? (
        <p className="text-sm text-major-nc">
          {review.error instanceof Error ? review.error.message : 'Could not record the review.'}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-sm">
        <Button
          onClick={() => submit(true)}
          loading={review.isPending}
          disabled={result.trim() === ''}
        >
          Effective — close
        </Button>
        <Button
          variant="outline"
          onClick={() => submit(false)}
          disabled={review.isPending || result.trim() === ''}
        >
          Not effective — reopen
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        Accepting closes this action and the finding it was raised against. Rejecting returns it to
        the responsible person.
      </p>
    </div>
  );
}
