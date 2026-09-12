import type {
  Audit,
  Client,
  CorrectiveAction,
  Finding,
} from '@soteria/core';
import { createClient } from '@/utils/supabase/client';

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

export async function insertAudit(tenantId: string, audit: Audit): Promise<void> {
  const { error } = await createClient().from('audits').insert({
    id: audit.id,
    tenant_id: requireTenantId(tenantId),
    client_id: audit.clientId,
    audit_number: audit.auditNumber,
    audit_type: audit.auditType,
    audit_stage: audit.auditStage,
    standard: audit.standard,
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
