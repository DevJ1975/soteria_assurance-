'use client';

/**
 * Live audit updates over Supabase Realtime.
 *
 * An audit is worked by a team at once — a lead auditor and two auditors spread
 * across a site, all raising findings against the same audit. Until now each of
 * them saw the others' work only when React Query happened to refetch, so two
 * auditors could write up the same observation twice and neither would know.
 *
 * WHAT THIS DOES NOT DO: it does not merge changes into the cache by hand. The
 * realtime payload is one row in database column shape, and turning that into
 * the domain type would mean a second, subtly different copy of the mappers in
 * supabase-data.ts. Instead a change invalidates the affected query and the
 * existing read path refetches — one source of truth for how a row becomes a
 * domain object, at the cost of one request per change.
 *
 * Tenant isolation carries over unchanged: Postgres Changes evaluates RLS per
 * subscriber, so a client is only sent rows it could already have selected.
 * That is the same policy proven in tests/src/tenant-isolation.test.ts, applied
 * to the socket.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useTenantId } from './hooks';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

/**
 * Subscribes to everything that changes during a live audit and refreshes the
 * matching queries.
 *
 * Pass an empty `auditId` to stay unsubscribed — the hook must still be called
 * unconditionally, so screens that resolve their audit id asynchronously do not
 * break the rules of hooks.
 */
export function useRealtimeAudit(auditId: string): RealtimeStatus {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (tenantId === '' || auditId === '') {
      setStatus('offline');
      return;
    }

    const supabase = createClient();
    setStatus('connecting');

    // Server-side filters, not client-side ones. Without `filter` every
    // subscriber in the tenant is woken for every audit's findings and discards
    // most of them; RLS would keep it correct but not quiet.
    const channel = supabase
      .channel(`audit:${auditId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'findings', filter: `audit_id=eq.${auditId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['findings', tenantId, auditId] });
          // The dashboard counts every finding in the tenant, so its own
          // tenant-wide query is stale too.
          void queryClient.invalidateQueries({ queryKey: ['findings', tenantId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clause_assessments',
          filter: `audit_id=eq.${auditId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['clauseAssessments', tenantId, auditId],
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audits', filter: `id=eq.${auditId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['audit', tenantId, auditId] });
          void queryClient.invalidateQueries({ queryKey: ['audits', tenantId] });
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [auditId, queryClient, tenantId]);

  return status;
}

/**
 * Tenant-wide corrective-action changes, for the corrective-actions screen.
 *
 * Separate from {@link useRealtimeAudit} because corrective actions outlive the
 * audit that raised them: they are chased for 60 or 90 days afterwards, and the
 * screen that tracks them is not scoped to one audit.
 */
export function useRealtimeCorrectiveActions(): RealtimeStatus {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (tenantId === '') {
      setStatus('offline');
      return;
    }

    const supabase = createClient();
    setStatus('connecting');

    const channel = supabase
      .channel(`tenant-cas:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corrective_actions',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['correctiveActions', tenantId] });
          // Accepting an effectiveness review closes the finding behind it, so
          // a corrective-action change can make a findings list stale too.
          void queryClient.invalidateQueries({ queryKey: ['findings'] });
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') setStatus('live');
        else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('offline');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId]);

  return status;
}
