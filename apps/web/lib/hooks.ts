'use client';

/**
 * React Query data hooks for the web app. Every read is tenant-scoped through
 * the `@soteria/firebase` collection helpers (RULE 2) — the tenant id comes from
 * the signed-in user's custom claims, never from user input. Each query stays
 * disabled until the tenant (and any required audit id) is known, so we never
 * issue an unscoped read.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  auditsCol,
  clauseAssessmentsCol,
  clientsCol,
  correctiveActionsCol,
  findingsCol,
  getDocById,
  listDocs,
} from '@soteria/firebase';
import type {
  Audit,
  ClauseAssessment,
  Client,
  CorrectiveAction,
  Finding,
} from '@soteria/core';
import { useAuth } from './auth-context';

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
    queryFn: () => listDocs(auditsCol(tenantId)),
    enabled: tenantId !== '',
  });
}

/** A single audit by id, scoped to the current tenant. */
export function useAudit(auditId: string): UseQueryResult<Audit | null> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['audit', tenantId, auditId],
    queryFn: () => getDocById(auditsCol(tenantId), auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/** All client organizations for the current tenant. */
export function useClients(): UseQueryResult<Client[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['clients', tenantId],
    queryFn: () => listDocs(clientsCol(tenantId)),
    enabled: tenantId !== '',
  });
}

/** All findings for an audit. */
export function useFindings(auditId: string): UseQueryResult<Finding[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['findings', tenantId, auditId],
    queryFn: () => listDocs(findingsCol(tenantId, auditId)),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/** All clause-by-clause assessments for an audit. */
export function useClauseAssessments(auditId: string): UseQueryResult<ClauseAssessment[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['clauseAssessments', tenantId, auditId],
    queryFn: () => listDocs(clauseAssessmentsCol(tenantId, auditId)),
    enabled: tenantId !== '' && auditId !== '',
  });
}

/** All corrective actions across the current tenant. */
export function useCorrectiveActions(): UseQueryResult<CorrectiveAction[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['correctiveActions', tenantId],
    queryFn: () => listDocs(correctiveActionsCol(tenantId)),
    enabled: tenantId !== '',
  });
}
