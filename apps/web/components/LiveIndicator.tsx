'use client';

import { cn } from '@/lib/cn';
import type { RealtimeStatus } from '@/lib/realtime';

/**
 * Shows whether this screen is receiving live updates from the rest of the
 * audit team.
 *
 * Worth showing rather than leaving implicit: an auditor who believes the
 * screen is live will trust a stale finding count, and on a site with poor
 * connectivity "live" is exactly the assumption that breaks first. Silence and
 * a dropped socket look identical without this.
 */
export function LiveIndicator({ status, className }: { status: RealtimeStatus; className?: string }) {
  const meta: Record<RealtimeStatus, { label: string; dot: string; text: string }> = {
    live: { label: 'Live', dot: 'bg-conforming', text: 'text-text-secondary' },
    connecting: { label: 'Connecting…', dot: 'bg-minor-nc animate-pulse', text: 'text-text-muted' },
    offline: { label: 'Not live', dot: 'bg-text-muted', text: 'text-text-muted' },
  };
  const { label, dot, text } = meta[status];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs', text, className)}
      // Announced politely: a connection flapping should not interrupt someone
      // mid-sentence while they are writing up a nonconformity.
      aria-live="polite"
      title={
        status === 'live'
          ? 'Changes from other auditors on this audit appear automatically.'
          : 'Changes from other auditors will not appear until you reload.'
      }
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}
