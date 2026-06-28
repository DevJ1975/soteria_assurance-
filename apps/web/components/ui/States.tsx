'use client';

import { Loader2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';

/** Centered loading state. */
export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <span className="inline-flex items-center gap-sm text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {label ?? SoteriaStrings.common.loading}
      </span>
    </div>
  );
}

/** Empty state with a message. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface p-lg text-center">
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

/** Inline error state. */
export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-md border border-major-nc/30 bg-major-nc/10 px-md py-2 text-sm text-major-nc">
      {message ?? SoteriaStrings.errors.generic}
    </div>
  );
}
