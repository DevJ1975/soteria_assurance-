import { DEFAULT_STANDARD_ID, type StandardId } from '@soteria/core';
import type {
  Audit,
  ClauseAssessment,
  Client,
  ConformityStatus,
  CorrectiveAction,
  Evidence,
  EvidenceType,
  Finding,
  SubClauseNote,
} from '@soteria/core';
import { createClient } from '@/utils/supabase/client';
import type { StorageBucket, UploadedObject } from './supabase-storage';

export function timestampFromDate(value: Date): {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
  toMillis: () => number;
} {
  const milliseconds = value.getTime();
  return {
    seconds: Math.floor(milliseconds / 1000),
    nanoseconds: (milliseconds % 1000) * 1_000_000,
    toDate: () => value,
    toMillis: () => milliseconds,
  };
}

export function timestampNow() {
  return timestampFromDate(new Date());
}

function requireTenantId(tenantId: string): string {
  if (tenantId.trim() === '') {
    throw new Error('A tenant id is required for this operation.');
  }
  return tenantId;
}

function mapRow<T>(row: Record<string, unknown>): T {
  return {
    ...row,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    auditId: row.audit_id,
    findingId: row.finding_id,
    auditNumber: row.audit_number,
    auditType: row.audit_type,
    auditStage: row.audit_stage,
    leadAuditorId: row.lead_auditor_id,
    auditTeam: row.audit_team,
    managementRepresentativeName: row.management_representative_name,
    plannedStartDate: row.planned_start_date,
    plannedEndDate: row.planned_end_date,
    auditDays: row.audit_days,
    sitesInScope: row.sites_in_scope,
    auditPlan: row.audit_plan,
    aiCertificationReadinessScore: row.ai_certification_readiness_score,
    aiRiskFlags: row.ai_risk_flags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    findingNumber: row.finding_number,
    clauseNumber: row.clause_number,
    clauseTitle: row.clause_title,
    objectiveEvidence: row.objective_evidence,
    nonconformityStatement: row.nonconformity_statement,
    evidenceIds: row.evidence_ids,
    raisedByAuditorId: row.raised_by_auditor_id,
    raisedByAuditorName: row.raised_by_auditor_name,
    raisedAt: row.raised_at,
    correctiveActionId: row.corrective_action_id,
    correctiveActionStatus: row.corrective_action_status,
    targetClosureDate: row.target_closure_date,
    actualClosureDate: row.actual_closure_date,
    closedAt: row.closed_at,
    closedByAuditorId: row.closed_by_auditor_id,
  } as T;
}

export async function listAudits(tenantId: string): Promise<Audit[]> {
  const { data, error } = await createClient()
    .from('audits')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('planned_start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow<Audit>(row));
}

export async function getAudit(tenantId: string, auditId: string): Promise<Audit | null> {
  const { data, error } = await createClient()
    .from('audits')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', auditId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow<Audit>(data) : null;
}

export async function listClients(tenantId: string): Promise<Client[]> {
  const { data, error } = await createClient()
    .from('clients')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('organization_name');
  if (error) throw error;
  return (data ?? []).map((row) => mapRow<Client>(row));
}

export async function listFindings(tenantId: string, auditId: string): Promise<Finding[]> {
  const { data, error } = await createClient()
    .from('findings')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('raised_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow<Finding>(row));
}

export async function listCorrectiveActions(tenantId: string): Promise<CorrectiveAction[]> {
  const { data, error } = await createClient()
    .from('corrective_actions')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId));
  if (error) throw error;
  return (data ?? []).map((row) => mapRow<CorrectiveAction>(row));
}

/**
 * Clause assessments carry nested sub-clause notes and two id arrays, none of
 * which the generic row mapper handles, so they get a dedicated mapper. The
 * timestamp columns become the structural {@link Timestamp} the domain types
 * expect rather than raw ISO strings.
 */
function mapClauseAssessment(row: Record<string, unknown>): ClauseAssessment {
  return {
    id: row.id as string,
    auditId: row.audit_id as string,
    tenantId: row.tenant_id as string,
    standardId: (row.standard_id as StandardId | null) ?? DEFAULT_STANDARD_ID,
    clauseNumber: row.clause_number as string,
    clauseTitle: row.clause_title as string,
    assignedAuditorId: (row.assigned_auditor_id as string | null) ?? '',
    conformityStatus: row.conformity_status as ConformityStatus,
    score: Number(row.score ?? 0),
    auditorNotes: (row.auditor_notes as string | null) ?? '',
    aiGeneratedSummary: (row.ai_generated_summary as string | null) ?? undefined,
    evidenceIds: (row.evidence_ids as string[] | null) ?? [],
    findingIds: (row.finding_ids as string[] | null) ?? [],
    subClauseNotes: (row.sub_clause_notes as SubClauseNote[] | null) ?? [],
    isComplete: Boolean(row.is_complete),
    completedAt: row.completed_at
      ? timestampFromDate(new Date(row.completed_at as string))
      : undefined,
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listClauseAssessments(
  tenantId: string,
  auditId: string,
): Promise<ClauseAssessment[]> {
  const { data, error } = await createClient()
    .from('clause_assessments')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('clause_number');
  if (error) throw error;
  return (data ?? []).map((row) => mapClauseAssessment(row));
}

/** The fields a clause assessment screen can actually change. */
export interface ClauseAssessmentInput {
  /** Which standard's clause this is — "6.1.2" alone is ambiguous. */
  standardId: StandardId;
  clauseNumber: string;
  clauseTitle: string;
  conformityStatus: ConformityStatus;
  score: number;
  auditorNotes: string;
  subClauseNotes: SubClauseNote[];
  evidenceIds?: string[];
  findingIds?: string[];
  assignedAuditorId?: string;
  isComplete: boolean;
}

/**
 * Writes one clause's assessment. `(audit_id, clause_number)` is unique, so an
 * upsert on that pair lets the UI save a clause without first knowing whether
 * the row exists — which matters because the clause list is generated from the
 * static ISO tree, not from the database.
 */
export async function upsertClauseAssessment(
  tenantId: string,
  auditId: string,
  input: ClauseAssessmentInput,
): Promise<ClauseAssessment> {
  const { data, error } = await createClient()
    .from('clause_assessments')
    .upsert(
      {
        tenant_id: requireTenantId(tenantId),
        audit_id: auditId,
        standard_id: input.standardId,
        clause_number: input.clauseNumber,
        clause_title: input.clauseTitle,
        conformity_status: input.conformityStatus,
        score: input.score,
        auditor_notes: input.auditorNotes,
        sub_clause_notes: input.subClauseNotes,
        evidence_ids: input.evidenceIds ?? [],
        finding_ids: input.findingIds ?? [],
        assigned_auditor_id: input.assignedAuditorId || null,
        is_complete: input.isComplete,
        // The stamp tracks the most recent sign-off, so an edit to a
        // completed clause re-dates it; clearing the flag clears the stamp.
        completed_at: input.isComplete ? new Date().toISOString() : null,
      },
      { onConflict: 'audit_id,clause_number' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return mapClauseAssessment(data);
}

/**
 * Evidence rows point at private storage objects. `storage_path` is the
 * durable reference; `file_url` is only populated for rows carried over from
 * the Firebase era, where the URL was the reference.
 */
function mapEvidence(row: Record<string, unknown>): Evidence {
  return {
    id: row.id as string,
    auditId: row.audit_id as string,
    tenantId: row.tenant_id as string,
    type: row.type as EvidenceType,
    title: row.title as string,
    description: (row.description as string | null) ?? '',
    fileUrl: (row.file_url as string | null) ?? '',
    fileName: row.file_name as string,
    fileSize: Number(row.file_size ?? 0),
    mimeType: row.mime_type as string,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? undefined,
    capturedAt: timestampFromDate(new Date((row.captured_at as string | null) ?? Date.now())),
    capturedByAuditorId: (row.captured_by_auditor_id as string | null) ?? '',
    clauseNumbers: (row.clause_numbers as string[] | null) ?? [],
    findingIds: (row.finding_ids as string[] | null) ?? [],
    aiAnalysis: (row.ai_analysis as string | null) ?? undefined,
    aiHazardsDetected: (row.ai_hazards_detected as string[] | null) ?? [],
    isVerified: Boolean(row.is_verified),
    verifiedAt: row.verified_at
      ? timestampFromDate(new Date(row.verified_at as string))
      : undefined,
    verifiedByAuditorId: (row.verified_by_auditor_id as string | null) ?? undefined,
  };
}

/** The storage location of an evidence row, for building a signed URL. */
export interface EvidenceObjectRef {
  bucket: StorageBucket;
  path: string;
}

export async function listEvidence(tenantId: string, auditId: string): Promise<Evidence[]> {
  const { data, error } = await createClient()
    .from('evidence')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('captured_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapEvidence(row));
}

/** Reads back where an evidence row's file actually lives. */
export async function getEvidenceObjectRef(
  tenantId: string,
  evidenceId: string,
): Promise<EvidenceObjectRef | null> {
  const { data, error } = await createClient()
    .from('evidence')
    .select('storage_bucket,storage_path')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', evidenceId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.storage_path) return null;
  return { bucket: data.storage_bucket as StorageBucket, path: data.storage_path };
}

export interface EvidenceInput {
  auditId: string;
  type: EvidenceType;
  title: string;
  description?: string;
  clauseNumbers?: string[];
  findingIds?: string[];
  capturedByAuditorId?: string;
}

/**
 * Records an uploaded object as audit evidence.
 *
 * Called after {@link uploadTenantFile} rather than doing the upload itself,
 * so a failed row insert leaves an orphaned object rather than an evidence
 * record pointing at a file that was never stored.
 */
export async function insertEvidence(
  tenantId: string,
  uploaded: UploadedObject,
  input: EvidenceInput,
): Promise<Evidence> {
  const { data, error } = await createClient()
    .from('evidence')
    .insert({
      tenant_id: requireTenantId(tenantId),
      audit_id: input.auditId,
      type: input.type,
      title: input.title,
      description: input.description ?? '',
      storage_bucket: uploaded.bucket,
      storage_path: uploaded.path,
      file_name: uploaded.fileName,
      file_size: uploaded.fileSize,
      mime_type: uploaded.mimeType,
      clause_numbers: input.clauseNumbers ?? [],
      finding_ids: input.findingIds ?? [],
      captured_by_auditor_id: input.capturedByAuditorId || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapEvidence(data);
}

export async function insertAudit(tenantId: string, audit: Audit): Promise<void> {
  const { error } = await createClient().from('audits').insert({
    id: audit.id,
    tenant_id: requireTenantId(tenantId),
    client_id: audit.clientId,
    audit_number: audit.auditNumber,
    audit_type: audit.auditType,
    audit_stage: audit.auditStage,
    standard_id: audit.standardId,
    scope: audit.scope,
    status: audit.status,
    lead_auditor_id: audit.leadAuditorId || null,
    audit_team: audit.auditTeam,
    management_representative_id: audit.managementRepresentativeId ?? null,
    management_representative_name: audit.managementRepresentativeName,
    planned_start_date: audit.plannedStartDate,
    planned_end_date: audit.plannedEndDate,
    audit_days: audit.auditDays,
    sites_in_scope: audit.sitesInScope,
    audit_plan: audit.auditPlan,
    findings: audit.findings,
    confidentiality: audit.confidentiality,
  });
  if (error) throw error;
}

export async function insertFinding(tenantId: string, finding: Finding): Promise<void> {
  const { error } = await createClient().from('findings').insert({
    id: finding.id,
    tenant_id: requireTenantId(tenantId),
    audit_id: finding.auditId,
    client_id: finding.clientId,
    finding_number: finding.findingNumber,
    type: finding.type,
    severity: finding.severity ?? null,
    clause_number: finding.clauseNumber,
    clause_title: finding.clauseTitle,
    requirement: finding.requirement,
    title: finding.title,
    objective_evidence: finding.objectiveEvidence,
    nonconformity_statement: finding.nonconformityStatement,
    evidence_ids: finding.evidenceIds,
    raised_by_auditor_id: finding.raisedByAuditorId || null,
    raised_by_auditor_name: finding.raisedByAuditorName,
    raised_at: new Date(finding.raisedAt.toMillis()).toISOString(),
    status: finding.status,
  });
  if (error) throw error;
}

/* ------------------------------------------------- effectiveness review */

/**
 * Records an auditor's effectiveness review of a corrective action.
 *
 * Goes through the `record_effectiveness_review` database function rather than
 * updating columns directly, because closure is a guarded transition: only a
 * submitted action can be reviewed, accepting it closes the finding behind it,
 * and rejecting reopens the action and clears its escalation clock. Doing that
 * from the client would mean four writes that can half-succeed.
 */
export async function recordEffectivenessReview(input: {
  correctiveActionId: string;
  effective: boolean;
  result: string;
  notes?: string;
}): Promise<void> {
  const { error } = await createClient().rpc('record_effectiveness_review', {
    p_corrective_action_id: input.correctiveActionId,
    p_effective: input.effective,
    p_result: input.result,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
}

/* ------------------------------------------------------- document numbers */

/**
 * Allocates the next sequence number for a tenant-scoped document series
 * (audit numbers, finding numbers, ...) for the given prefix and year.
 *
 * Goes through the `next_document_seq` database function rather than a
 * client-generated random number: audits and findings are each constrained
 * `UNIQUE (tenant_id, number)`, and a random 1-900 pick collides routinely at
 * real usage volumes. The function's upsert takes a row lock, so concurrent
 * callers in the same tenant get distinct, gapless sequence values rather than
 * racing on a value each computed independently.
 */
export async function nextDocumentSeq(
  tenantId: string,
  prefix: string,
  year: number,
): Promise<number> {
  const { data, error } = await createClient().rpc('next_document_seq', {
    p_tenant_id: requireTenantId(tenantId),
    p_prefix: prefix,
    p_year: year,
  });
  if (error) throw error;
  return data as number;
}
