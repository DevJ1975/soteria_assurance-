'use client';

/**
 * React Query data hooks for the web app. Every read is tenant-scoped through
 * the Supabase data helpers (RULE 2) — the tenant id comes from
 * the signed-in user's custom claims, never from user input. Each query stays
 * disabled until the tenant (and any required audit id) is known, so we never
 * issue an unscoped read.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  Audit,
  ClauseAssessment,
  Client,
  CorrectiveAction,
  Finding,
} from '@soteria/core';
import { useAuth } from './auth-context';
import {
  getAudit,
  listAudits,
  listClauseAssessments,
  listClients,
  listCorrectiveActions,
  listFindings,
  recordEffectivenessReview,
  upsertClauseAssessment,
  type ClauseAssessmentInput,
} from './supabase-data';

/** Current tenant id from auth claims, or `''` before claims have resolved. */
export function useTenantId(): string {
  const { claims } = useAuth();
  return claims?.tenantId ?? '';
}

/** All audits for the current tenant. */
export function useAudits(): UseQueryResult<Audit[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['audits', tenantId],
    queryFn: () => listAudits(tenantId),
    enabled: tenantId !== '',
  });
}

/** A single audit by id, scoped to the current tenant. */
export function useAudit(auditId: string): UseQueryResult<Audit | null> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['audit', tenantId, auditId],
    queryFn: () => getAudit(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/** All client organizations for the current tenant. */
export function useClients(): UseQueryResult<Client[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['clients', tenantId],
    queryFn: () => listClients(tenantId),
    enabled: tenantId !== '',
  });
}

/** All findings for an audit. */
export function useFindings(auditId: string): UseQueryResult<Finding[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['findings', tenantId, auditId],
    queryFn: () => listFindings(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/** All clause-by-clause assessments for an audit. */
export function useClauseAssessments(auditId: string): UseQueryResult<ClauseAssessment[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['clauseAssessments', tenantId, auditId],
    queryFn: () => listClauseAssessments(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/**
 * Saves one clause's assessment and refreshes the audit's clause list.
 *
 * The mutation deliberately invalidates rather than patching the cache by
 * hand: the row that comes back carries database-side values (generated id,
 * `updated_at`, the completion stamp) that a local merge would get wrong.
 */
export function useSaveClauseAssessment(
  auditId: string,
): UseMutationResult<ClauseAssessment, Error, ClauseAssessmentInput> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClauseAssessmentInput) =>
      upsertClauseAssessment(tenantId, auditId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['clauseAssessments', tenantId, auditId],
      });
    },
  });
}

/** All corrective actions across the current tenant. */
export function useCorrectiveActions(): UseQueryResult<CorrectiveAction[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['correctiveActions', tenantId],
    queryFn: () => listCorrectiveActions(tenantId),
    enabled: tenantId !== '',
  });
}

/**
 * Reviews a corrective action's effectiveness.
 *
 * Invalidates findings as well as corrective actions: accepting a review
 * closes the finding the action was raised against, so a list showing only
 * corrective actions would leave a stale "open" finding on screen.
 */
export function useRecordEffectivenessReview(): UseMutationResult<
  void,
  Error,
  { correctiveActionId: string; effective: boolean; result: string; notes?: string }
> {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: recordEffectivenessReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['corrective-actions', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['findings'] });
    },
  });
}
