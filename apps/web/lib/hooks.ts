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
  AuditProgramme,
  AuditorDeclaration,
  ClauseAssessment,
  Client,
  CorrectiveAction,
  Finding,
  Evidence,
  Meeting,
} from '@soteria/core';
import { useAuth } from './auth-context';
import {
  getAudit,
  getEvidenceObjectRef,
  insertClient,
  insertCorrectiveAction,
  insertEvidence,
  insertProgramme,
  listAllFindings,
  listAudits,
  listClauseAssessments,
  listClients,
  listCorrectiveActions,
  listDeclarations,
  listEvidence,
  listFindings,
  listMeetings,
  listProgrammes,
  recordCertificationDecision,
  recordEffectivenessReview,
  reviewDeclaration,
  sha256Hex,
  submitCorrectiveAction,
  type ClauseAssessmentInput,
  updateAudit,
  updateClient,
  updateCorrectiveAction,
  upsertClauseAssessment,
  upsertDeclaration,
  upsertMeeting,
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

/** Every finding across the current tenant — for dashboard-wide counts. */
export function useAllFindings(): UseQueryResult<Finding[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['findings', tenantId],
    queryFn: () => listAllFindings(tenantId),
    enabled: tenantId !== '',
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
      void queryClient.invalidateQueries({ queryKey: ['correctiveActions', tenantId] });
      void queryClient.invalidateQueries({ queryKey: ['findings'] });
    },
  });
}

/**
 * Creates a client organization and refreshes the list.
 *
 * This is the first write path to `clients` in the product. Without it the New
 * Audit wizard's client dropdown is permanently empty and no audit can be
 * created on a fresh tenant.
 */
export function useCreateClient(): UseMutationResult<
  void,
  Error,
  Parameters<typeof insertClient>[1]
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (client: Parameters<typeof insertClient>[1]) => insertClient(tenantId, client),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
    },
  });
}

export function useUpdateClient(): UseMutationResult<
  void,
  Error,
  { clientId: string; patch: Parameters<typeof updateClient>[2] }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, patch }: { clientId: string; patch: Parameters<typeof updateClient>[2] }) =>
      updateClient(tenantId, clientId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients', tenantId] });
    },
  });
}

/**
 * Moves an audit through its lifecycle, or edits its plan.
 *
 * Invalidates both the list and the single-audit query, because the audit
 * register and the detail page render the same row.
 */
export function useUpdateAudit(): UseMutationResult<
  void,
  Error,
  { auditId: string; patch: Parameters<typeof updateAudit>[2] }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ auditId, patch }: { auditId: string; patch: Parameters<typeof updateAudit>[2] }) =>
      updateAudit(tenantId, auditId, patch),
    onSuccess: async (_result, { auditId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['audits', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['audit', tenantId, auditId] }),
      ]);
    },
  });
}

/** Raises a corrective action against a finding. */
export function useCreateCorrectiveAction(): UseMutationResult<
  void,
  Error,
  Parameters<typeof insertCorrectiveAction>[1]
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ca: Parameters<typeof insertCorrectiveAction>[1]) =>
      insertCorrectiveAction(tenantId, ca),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['correctiveActions', tenantId] });
    },
  });
}

/**
 * Submits a corrective action for effectiveness review.
 *
 * `record_effectiveness_review` refuses any status other than
 * submitted/accepted/rejected, so without this the review control could never
 * succeed on product-created data.
 */
export function useSubmitCorrectiveAction(): UseMutationResult<
  void,
  Error,
  { caId: string; submittedBy: string }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caId, submittedBy }: { caId: string; submittedBy: string }) =>
      submitCorrectiveAction(tenantId, caId, submittedBy),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['correctiveActions', tenantId] });
    },
  });
}

export function useUpdateCorrectiveAction(): UseMutationResult<
  void,
  Error,
  { caId: string; patch: Parameters<typeof updateCorrectiveAction>[2] }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caId, patch }: { caId: string; patch: Parameters<typeof updateCorrectiveAction>[2] }) =>
      updateCorrectiveAction(tenantId, caId, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['correctiveActions', tenantId] });
    },
  });
}

/** Opening and closing meeting records for an audit. */
export function useMeetings(auditId: string): UseQueryResult<Meeting[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['meetings', tenantId, auditId],
    queryFn: () => listMeetings(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

export function useSaveMeeting(
  auditId: string,
): UseMutationResult<void, Error, Parameters<typeof upsertMeeting>[1]> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meeting: Parameters<typeof upsertMeeting>[1]) =>
      upsertMeeting(tenantId, meeting),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['meetings', tenantId, auditId] });
    },
  });
}

/** Evidence captured against an audit. */
export function useEvidence(auditId: string): UseQueryResult<Evidence[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['evidence', tenantId, auditId],
    queryFn: () => listEvidence(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

export function useProgrammes(): UseQueryResult<AuditProgramme[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['programmes', tenantId],
    queryFn: () => listProgrammes(tenantId),
    enabled: tenantId !== '',
  });
}

export function useCreateProgramme(): UseMutationResult<
  void,
  Error,
  Parameters<typeof insertProgramme>[1]
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (programme: Parameters<typeof insertProgramme>[1]) =>
      insertProgramme(tenantId, programme),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programmes', tenantId] });
    },
  });
}

export function useRecordCertificationDecision(): UseMutationResult<
  void,
  Error,
  { programmeId: string; input: Parameters<typeof recordCertificationDecision>[2] }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ programmeId, input }: { programmeId: string; input: Parameters<typeof recordCertificationDecision>[2] }) =>
      recordCertificationDecision(tenantId, programmeId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['programmes', tenantId] });
    },
  });
}

export function useDeclarations(auditId: string): UseQueryResult<AuditorDeclaration[]> {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ['declarations', tenantId, auditId],
    queryFn: () => listDeclarations(tenantId, auditId),
    enabled: tenantId !== '' && auditId !== '',
  });
}

export function useDeclare(auditId: string): UseMutationResult<
  void,
  Error,
  Parameters<typeof upsertDeclaration>[1]
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertDeclaration>[1]) =>
      upsertDeclaration(tenantId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['declarations', tenantId, auditId] });
    },
  });
}

export function useReviewDeclaration(auditId: string): UseMutationResult<
  void,
  Error,
  { declarationId: string; input: Parameters<typeof reviewDeclaration>[2] }
> {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ declarationId, input }: { declarationId: string; input: Parameters<typeof reviewDeclaration>[2] }) =>
      reviewDeclaration(tenantId, declarationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['declarations', tenantId, auditId] });
    },
  });
}
