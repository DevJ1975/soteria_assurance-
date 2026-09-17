import { DEFAULT_STANDARD_ID, type StandardId } from '@soteria/core';
import type {
  Audit,
  AuditProgramme,
  AuditorDeclaration,
  CAHistoryEntry,
  ClauseAssessment,
  Client,
  ClientAddress,
  ClientSite,
  ConformityStatus,
  CorrectiveAction,
  Evidence,
  EvidenceType,
  Finding,
  Meeting,
  MeetingActionItem,
  MeetingAgendaItem,
  MeetingAttendee,
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

/**
 * A single generic mapper covering both audits and findings used to leave
 * every field it didn't explicitly alias as `undefined` on the mapped
 * object — missing `standardId` crashed the audit-detail page outright, and
 * every timestamp field (`createdAt`, `raisedAt`, `closedAt`, ...) came back
 * as a raw ISO string instead of the structural {@link Timestamp} the domain
 * types declare, safe only because nothing had yet called `.toMillis()` on
 * one read back from the database. Split into dedicated mappers, the same
 * fix already applied to clients and corrective actions.
 */
function mapAudit(row: Record<string, unknown>): Audit {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    programmeId: (row.programme_id as string | null) ?? undefined,
    clientId: row.client_id as string,
    auditNumber: row.audit_number as string,
    auditType: row.audit_type as Audit['auditType'],
    auditStage: row.audit_stage as Audit['auditStage'],
    standardId: (row.standard_id as StandardId | null) ?? DEFAULT_STANDARD_ID,
    scope: row.scope as string,
    status: row.status as Audit['status'],
    leadAuditorId: row.lead_auditor_id as string,
    auditTeam: (row.audit_team as Audit['auditTeam'] | null) ?? [],
    managementRepresentativeId: (row.management_representative_id as string | null) ?? undefined,
    managementRepresentativeName: row.management_representative_name as string,
    plannedStartDate: row.planned_start_date as string,
    plannedEndDate: row.planned_end_date as string,
    actualStartDate: (row.actual_start_date as string | null) ?? undefined,
    actualEndDate: (row.actual_end_date as string | null) ?? undefined,
    auditDays: Number(row.audit_days ?? 0),
    sitesInScope: (row.sites_in_scope as string[] | null) ?? [],
    auditPlan: (row.audit_plan as Audit['auditPlan'] | null) ?? {
      activities: [],
      documentReviewList: [],
      intervieweeList: [],
      areaInspectionList: [],
    },
    findings: (row.findings as Audit['findings'] | null) ?? {
      totalFindings: 0,
      majorNCs: 0,
      minorNCs: 0,
      ofis: 0,
      strongPoints: 0,
      observations: 0,
      closedNCs: 0,
      openNCs: 0,
    },
    aiCertificationReadinessScore: (row.ai_certification_readiness_score as number | null) ?? undefined,
    aiRiskFlags: (row.ai_risk_flags as string[] | null) ?? [],
    confidentiality: row.confidentiality as Audit['confidentiality'],
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
    completedAt: row.completed_at
      ? timestampFromDate(new Date(row.completed_at as string))
      : undefined,
    reportIssuedAt: row.report_issued_at
      ? timestampFromDate(new Date(row.report_issued_at as string))
      : undefined,
  };
}

export async function listAudits(tenantId: string): Promise<Audit[]> {
  const { data, error } = await createClient()
    .from('audits')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('planned_start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAudit(row));
}

export async function getAudit(tenantId: string, auditId: string): Promise<Audit | null> {
  const { data, error } = await createClient()
    .from('audits')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', auditId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAudit(data) : null;
}

function mapFinding(row: Record<string, unknown>): Finding {
  return {
    id: row.id as string,
    auditId: row.audit_id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    findingNumber: row.finding_number as string,
    type: row.type as Finding['type'],
    severity: (row.severity as Finding['severity'] | null) ?? undefined,
    clauseNumber: row.clause_number as string,
    clauseTitle: row.clause_title as string,
    requirement: row.requirement as string,
    title: row.title as string,
    objectiveEvidence: row.objective_evidence as string,
    nonconformityStatement: row.nonconformity_statement as string,
    aiDraftStatement: (row.ai_draft_statement as string | null) ?? undefined,
    siteId: (row.site_id as string | null) ?? undefined,
    department: (row.department as string | null) ?? undefined,
    area: (row.area as string | null) ?? undefined,
    evidenceIds: (row.evidence_ids as string[] | null) ?? [],
    raisedByAuditorId: row.raised_by_auditor_id as string,
    raisedByAuditorName: row.raised_by_auditor_name as string,
    raisedAt: timestampFromDate(new Date((row.raised_at as string | null) ?? Date.now())),
    acknowledgedByName: (row.acknowledged_by_name as string | null) ?? undefined,
    acknowledgedBySignatureUrl: (row.acknowledged_by_signature_url as string | null) ?? undefined,
    acknowledgedAt: row.acknowledged_at
      ? timestampFromDate(new Date(row.acknowledged_at as string))
      : undefined,
    correctiveActionId: (row.corrective_action_id as string | null) ?? undefined,
    correctiveActionStatus: (row.corrective_action_status as Finding['correctiveActionStatus']) ?? undefined,
    targetClosureDate: (row.target_closure_date as string | null) ?? undefined,
    actualClosureDate: (row.actual_closure_date as string | null) ?? undefined,
    status: row.status as Finding['status'],
    closedAt: row.closed_at ? timestampFromDate(new Date(row.closed_at as string)) : undefined,
    closedByAuditorId: (row.closed_by_auditor_id as string | null) ?? undefined,
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

/**
 * Clients carry two nested JSON structures (address, sites) and a plain
 * uuid[] of audit ids, none of which the generic row mapper handles — and
 * without a dedicated mapper this table's rows were returned bare, so every
 * screen reading `client.organizationName` / `.certificationStatus` /
 * `.numberOfEmployees` silently read `undefined`. Nested JSON is stored
 * already shaped like its domain type (the same convention `audit_plan` and
 * `audit_team` use on audits), so it is cast through rather than re-mapped
 * key by key.
 */
function mapClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    organizationName: row.organization_name as string,
    industry: (row.industry as string | null) ?? '',
    address: (row.address as ClientAddress | null) ?? ({} as ClientAddress),
    contactName: (row.contact_name as string | null) ?? '',
    contactEmail: (row.contact_email as string | null) ?? '',
    contactPhone: (row.contact_phone as string | null) ?? '',
    numberOfEmployees: Number(row.number_of_employees ?? 0),
    numberOfSites: Number(row.number_of_sites ?? 0),
    sites: (row.sites as ClientSite[] | null) ?? [],
    certificationStatus: row.certification_status as Client['certificationStatus'],
    certificationBody: (row.certification_body as string | null) ?? undefined,
    certificationExpiry: (row.certification_expiry as string | null) ?? undefined,
    auditHistory: (row.audit_history as string[] | null) ?? [],
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listClients(tenantId: string): Promise<Client[]> {
  const { data, error } = await createClient()
    .from('clients')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('organization_name');
  if (error) throw error;
  return (data ?? []).map((row) => mapClient(row));
}

export async function listFindings(tenantId: string, auditId: string): Promise<Finding[]> {
  const { data, error } = await createClient()
    .from('findings')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('raised_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapFinding(row));
}

/**
 * Every finding across the tenant, not just one audit's. The dashboard's
 * open-nonconformity counts and severity breakdown need this: `audits.findings`
 * is a denormalized summary nothing ever recomputes after an audit is
 * created, so it reads all-zero forever once a real finding exists — this
 * gives the dashboard a live source to compute those counts from instead.
 */
export async function listAllFindings(tenantId: string): Promise<Finding[]> {
  const { data, error } = await createClient()
    .from('findings')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId));
  if (error) throw error;
  return (data ?? []).map((row) => mapFinding(row));
}

/**
 * Corrective actions have the same problem as clients: nothing aliased their
 * columns, so `ca.caNumber`, `.responsiblePersonName` and `.targetDate` — what
 * the corrective-actions screen actually reads — were all `undefined`.
 *
 * `history` entries are stored as `{timestamp, action, performedBy, notes}`
 * (see 20260913020000_fix_ca_history_shape.sql), matching this type field for
 * field, except `timestamp` is a raw ISO string in the jsonb — it still needs
 * converting to a structural {@link Timestamp} the way `completedAt` and
 * `updatedAt` are below.
 */
interface RawCAHistoryEntry {
  timestamp: string;
  action: string;
  performedBy: string;
  notes?: string;
}

function mapCAHistory(rawHistory: RawCAHistoryEntry[] | null): CAHistoryEntry[] {
  return (rawHistory ?? []).map((entry) => ({
    ...entry,
    timestamp: timestampFromDate(new Date(entry.timestamp)),
  }));
}

function mapCorrectiveAction(row: Record<string, unknown>): CorrectiveAction {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    auditId: row.audit_id as string,
    findingId: row.finding_id as string,
    caNumber: row.ca_number as string,
    title: row.title as string,
    rootCauseMethod: row.root_cause_method as CorrectiveAction['rootCauseMethod'],
    rootCauseAnalysis: (row.root_cause_analysis as string | null) ?? '',
    immediateAction: (row.immediate_action as string | null) ?? '',
    correctiveAction: (row.corrective_action as string | null) ?? '',
    preventiveAction: (row.preventive_action as string | null) ?? '',
    effectivenessCheck: (row.effectiveness_check as string | null) ?? '',
    effectivenessCheckDate: (row.effectiveness_check_date as string | null) ?? undefined,
    effectivenessResult: (row.effectiveness_result as CorrectiveAction['effectivenessResult']) ?? undefined,
    responsiblePersonName: (row.responsible_person_name as string | null) ?? '',
    responsiblePersonEmail: (row.responsible_person_email as string | null) ?? '',
    targetDate: row.target_date as string,
    submittedDate: (row.submitted_date as string | null) ?? undefined,
    reviewedDate: (row.reviewed_date as string | null) ?? undefined,
    closedDate: (row.closed_date as string | null) ?? undefined,
    closureEvidenceIds: (row.closure_evidence_ids as string[] | null) ?? [],
    closureNotes: (row.closure_notes as string | null) ?? undefined,
    reviewedByAuditorId: (row.reviewed_by_auditor_id as string | null) ?? undefined,
    reviewNotes: (row.review_notes as string | null) ?? undefined,
    status: row.status as CorrectiveAction['status'],
    aiRootCauseSuggestion: (row.ai_root_cause_suggestion as string | null) ?? undefined,
    history: mapCAHistory(row.history as RawCAHistoryEntry[] | null),
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listCorrectiveActions(tenantId: string): Promise<CorrectiveAction[]> {
  const { data, error } = await createClient()
    .from('corrective_actions')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId));
  if (error) throw error;
  return (data ?? []).map((row) => mapCorrectiveAction(row));
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
    contentSha256: (row.content_sha256 as string | null) ?? undefined,
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
    geoLocation: (row.geo_location as Evidence['geoLocation'] | null) ?? undefined,
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
  /**
   * Lowercase hex SHA-256 of the uploaded bytes. Recorded at capture so a
   * later reader can prove the file they fetched is the file the auditor
   * captured — the evidence bucket is write-once, but a digest is what makes
   * that demonstrable rather than merely asserted.
   */
  contentSha256?: string;
}

/**
 * Computes the SHA-256 of a file, as lowercase hex.
 *
 * Runs in the browser over the same bytes that are uploaded, so the digest
 * describes what was actually stored rather than what the server later
 * happened to read.
 */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
      content_sha256: input.contentSha256 ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapEvidence(data);
}

/**
 * Creates a client organization.
 *
 * Until this existed there was NO code path anywhere in the product — web,
 * mobile or Edge Function — that inserted a `clients` row. The New Audit
 * wizard requires a client, so its dropdown was permanently empty and no audit
 * could be created at all on a fresh tenant. The e2e suite only passed because
 * it inserts clients directly with the service role, stepping around the app.
 */
/**
 * Opening and closing meeting records (ISO 19011 §6.4.3 / §6.4.10).
 *
 * These are mandatory audit records: attendance, and — for the closing meeting
 * — the record that the findings were presented. Before the `meetings` table
 * existed, none of it was persisted anywhere; an accreditation body reviewing
 * the audit file found an audio blob and no record that a meeting occurred.
 */
function mapMeeting(row: Record<string, unknown>): Meeting {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    auditId: row.audit_id as string,
    type: row.type as Meeting['type'],
    scheduledAt: timestampFromDate(new Date((row.scheduled_at as string | null) ?? Date.now())),
    actualStartAt:
      row.actual_start_at !== null && row.actual_start_at !== undefined
        ? timestampFromDate(new Date(row.actual_start_at as string))
        : undefined,
    actualEndAt:
      row.actual_end_at !== null && row.actual_end_at !== undefined
        ? timestampFromDate(new Date(row.actual_end_at as string))
        : undefined,
    location: (row.location as string | null) ?? '',
    isVirtual: Boolean(row.is_virtual),
    virtualLink: (row.virtual_link as string | null) ?? undefined,
    attendees: (row.attendees as MeetingAttendee[] | null) ?? [],
    agendaItems: (row.agenda_items as MeetingAgendaItem[] | null) ?? [],
    actionItems: (row.action_items as MeetingActionItem[] | null) ?? [],
    signatureUrls: (row.signature_urls as Meeting['signatureUrls'] | null) ?? [],
    keyDecisions: (row.key_decisions as string[] | null) ?? [],
    recordingUrl: (row.recording_url as string | null) ?? undefined,
    recordingDuration: (row.recording_duration as number | null) ?? undefined,
    transcription: (row.transcription as string | null) ?? undefined,
    aiSummary: (row.ai_summary as string | null) ?? undefined,
    findingsSummaryPresented:
      (row.findings_summary_presented as Meeting['findingsSummaryPresented']) ?? undefined,
    status: row.status as Meeting['status'],
    notes: (row.notes as string | null) ?? '',
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listMeetings(tenantId: string, auditId: string): Promise<Meeting[]> {
  const { data, error } = await createClient()
    .from('meetings')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('type');
  if (error) throw error;
  return (data ?? []).map((row) => mapMeeting(row));
}

/**
 * Creates or replaces the opening/closing meeting record for an audit.
 *
 * Upserts on `(audit_id, type)` — the table's unique index — because a second
 * "opening meeting" is a correction to the first, not a new record.
 */
export async function upsertMeeting(
  tenantId: string,
  meeting: Omit<Meeting, 'tenantId' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const { error } = await createClient()
    .from('meetings')
    .upsert(
      {
        tenant_id: requireTenantId(tenantId),
        audit_id: meeting.auditId,
        type: meeting.type,
        scheduled_at: new Date(meeting.scheduledAt.toMillis()).toISOString(),
        actual_start_at:
          meeting.actualStartAt !== undefined
            ? new Date(meeting.actualStartAt.toMillis()).toISOString()
            : null,
        actual_end_at:
          meeting.actualEndAt !== undefined
            ? new Date(meeting.actualEndAt.toMillis()).toISOString()
            : null,
        location: meeting.location,
        is_virtual: meeting.isVirtual,
        virtual_link: meeting.virtualLink ?? null,
        attendees: meeting.attendees,
        agenda_items: meeting.agendaItems,
        action_items: meeting.actionItems ?? [],
        signature_urls: meeting.signatureUrls,
        key_decisions: meeting.keyDecisions ?? [],
        recording_url: meeting.recordingUrl ?? null,
        transcription: meeting.transcription ?? null,
        ai_summary: meeting.aiSummary ?? null,
        findings_summary_presented: meeting.findingsSummaryPresented ?? null,
        status: meeting.status,
        notes: meeting.notes,
      },
      { onConflict: 'audit_id,type' },
    );
  if (error) throw error;
}

/**
 * Audit programmes — one client's certification cycle against one standard
 * (ISO/IEC 17021-1 §9.1.2). See the migration header for why these exist.
 */
function mapProgramme(row: Record<string, unknown>): AuditProgramme {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    clientId: row.client_id as string,
    standardId: row.standard_id as AuditProgramme['standardId'],
    cycleStart: row.cycle_start as string,
    cycleEnd: row.cycle_end as string,
    status: row.status as AuditProgramme['status'],
    certificationDecision: row.certification_decision as AuditProgramme['certificationDecision'],
    decidedAt:
      row.decided_at !== null && row.decided_at !== undefined
        ? timestampFromDate(new Date(row.decided_at as string))
        : undefined,
    decidedById: (row.decided_by as string | null) ?? undefined,
    decisionNotes: (row.decision_notes as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? '',
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listProgrammes(tenantId: string): Promise<AuditProgramme[]> {
  const { data, error } = await createClient()
    .from('audit_programmes')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .order('cycle_start', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapProgramme(row));
}

export async function insertProgramme(
  tenantId: string,
  programme: Pick<AuditProgramme, 'id' | 'clientId' | 'standardId' | 'cycleStart' | 'cycleEnd' | 'notes'>,
): Promise<void> {
  const { error } = await createClient().from('audit_programmes').insert({
    id: programme.id,
    tenant_id: requireTenantId(tenantId),
    client_id: programme.clientId,
    standard_id: programme.standardId,
    cycle_start: programme.cycleStart,
    cycle_end: programme.cycleEnd,
    status: 'active',
    notes: programme.notes,
  });
  if (error) throw error;
}

/**
 * Records the certification decision for a cycle. The database refuses a
 * decision maker who sat on the audit team for any audit in the cycle
 * (17021-1 §9.5.1), so this throws rather than silently recording a
 * non-independent decision.
 */
export async function recordCertificationDecision(
  tenantId: string,
  programmeId: string,
  input: {
    decision: Exclude<AuditProgramme['certificationDecision'], 'pending'>;
    decidedById: string;
    notes?: string;
  },
): Promise<void> {
  const { error } = await createClient()
    .from('audit_programmes')
    .update({
      certification_decision: input.decision,
      decided_by: input.decidedById,
      decided_at: new Date().toISOString(),
      decision_notes: input.notes ?? null,
      status: input.decision === 'granted' ? 'active' : input.decision,
    })
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', programmeId);
  if (error) throw error;
}

/**
 * Per-engagement competence and impartiality declarations
 * (ISO/IEC 17021-1 §5.2, §7.1–7.2).
 */
function mapDeclaration(row: Record<string, unknown>): AuditorDeclaration {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    auditId: row.audit_id as string,
    auditorId: row.auditor_id as string,
    auditorName: row.auditor_name as string,
    competenceStatement: (row.competence_statement as string | null) ?? '',
    hasConflict: Boolean(row.has_conflict),
    conflictDetails: (row.conflict_details as string | null) ?? '',
    mitigation: (row.mitigation as string | null) ?? '',
    declaredAt: timestampFromDate(new Date((row.declared_at as string | null) ?? Date.now())),
    reviewedById: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: (row.reviewed_by_name as string | null) ?? undefined,
    reviewedAt:
      row.reviewed_at !== null && row.reviewed_at !== undefined
        ? timestampFromDate(new Date(row.reviewed_at as string))
        : undefined,
    reviewOutcome: (row.review_outcome as AuditorDeclaration['reviewOutcome'] | null) ?? undefined,
    reviewNotes: (row.review_notes as string | null) ?? undefined,
    createdAt: timestampFromDate(new Date((row.created_at as string | null) ?? Date.now())),
    updatedAt: timestampFromDate(new Date((row.updated_at as string | null) ?? Date.now())),
  };
}

export async function listDeclarations(
  tenantId: string,
  auditId: string,
): Promise<AuditorDeclaration[]> {
  const { data, error } = await createClient()
    .from('auditor_declarations')
    .select('*')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('audit_id', auditId)
    .order('auditor_name');
  if (error) throw error;
  return (data ?? []).map((row) => mapDeclaration(row));
}

/** An auditor declares (or amends their declaration) for an audit. */
export async function upsertDeclaration(
  tenantId: string,
  input: Pick<
    AuditorDeclaration,
    'auditId' | 'auditorId' | 'auditorName' | 'competenceStatement' | 'hasConflict' | 'conflictDetails' | 'mitigation'
  >,
): Promise<void> {
  const { error } = await createClient()
    .from('auditor_declarations')
    .upsert(
      {
        tenant_id: requireTenantId(tenantId),
        audit_id: input.auditId,
        auditor_id: input.auditorId,
        auditor_name: input.auditorName,
        competence_statement: input.competenceStatement,
        has_conflict: input.hasConflict,
        conflict_details: input.conflictDetails,
        mitigation: input.mitigation,
        declared_at: new Date().toISOString(),
        // Amending a declaration invalidates any prior review of it.
        reviewed_by: null,
        reviewed_by_name: null,
        reviewed_at: null,
        review_outcome: null,
        review_notes: null,
      },
      { onConflict: 'audit_id,auditor_id' },
    );
  if (error) throw error;
}

/**
 * Someone OTHER than the declarant reviews the declaration. The database
 * rejects self-review; this surfaces that as a thrown error.
 */
export async function reviewDeclaration(
  tenantId: string,
  declarationId: string,
  input: { reviewerId: string; reviewerName: string; outcome: 'accepted' | 'rejected'; notes?: string },
): Promise<void> {
  const { error } = await createClient()
    .from('auditor_declarations')
    .update({
      reviewed_by: input.reviewerId,
      reviewed_by_name: input.reviewerName,
      reviewed_at: new Date().toISOString(),
      review_outcome: input.outcome,
      review_notes: input.notes ?? null,
    })
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', declarationId);
  if (error) throw error;
}

export async function insertClient(
  tenantId: string,
  client: Omit<Client, 'tenantId' | 'auditHistory' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const { error } = await createClient().from('clients').insert({
    id: client.id,
    tenant_id: requireTenantId(tenantId),
    organization_name: client.organizationName,
    industry: client.industry,
    address: client.address,
    contact_name: client.contactName,
    contact_email: client.contactEmail,
    contact_phone: client.contactPhone,
    number_of_employees: client.numberOfEmployees,
    number_of_sites: client.numberOfSites,
    sites: client.sites,
    certification_status: client.certificationStatus,
    certification_body: client.certificationBody ?? null,
    certification_expiry: client.certificationExpiry ?? null,
  });
  if (error) throw error;
}

export async function updateClient(
  tenantId: string,
  clientId: string,
  patch: Partial<Pick<Client,
    | 'organizationName' | 'industry' | 'address' | 'contactName' | 'contactEmail'
    | 'contactPhone' | 'numberOfEmployees' | 'numberOfSites' | 'sites'
    | 'certificationStatus' | 'certificationBody' | 'certificationExpiry'>>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.organizationName !== undefined) row.organization_name = patch.organizationName;
  if (patch.industry !== undefined) row.industry = patch.industry;
  if (patch.address !== undefined) row.address = patch.address;
  if (patch.contactName !== undefined) row.contact_name = patch.contactName;
  if (patch.contactEmail !== undefined) row.contact_email = patch.contactEmail;
  if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone;
  if (patch.numberOfEmployees !== undefined) row.number_of_employees = patch.numberOfEmployees;
  if (patch.numberOfSites !== undefined) row.number_of_sites = patch.numberOfSites;
  if (patch.sites !== undefined) row.sites = patch.sites;
  if (patch.certificationStatus !== undefined) row.certification_status = patch.certificationStatus;
  if (patch.certificationBody !== undefined) row.certification_body = patch.certificationBody ?? null;
  if (patch.certificationExpiry !== undefined) row.certification_expiry = patch.certificationExpiry ?? null;
  if (Object.keys(row).length === 0) return;

  const { error } = await createClient()
    .from('clients')
    .update(row)
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', clientId);
  if (error) throw error;
}

/**
 * Updates an audit.
 *
 * No web code updated the `audits` table at all before this: `actual_start_date`,
 * `actual_end_date`, `completed_at` and `report_issued_at` were read by the row
 * mapper and written by nothing, so every audit stayed `planned` for its whole
 * life with null actual dates. The audit register showed a permanent list of
 * planned audits with no evidence any of them had been conducted.
 *
 * Note the database refuses an edit to a finding or clause assessment once the
 * parent audit reaches `report_issued` or `closed` (see the lifecycle-lock
 * trigger), so issuing a report is a deliberate one-way step.
 */
export async function updateAudit(
  tenantId: string,
  auditId: string,
  patch: Partial<Pick<Audit,
    | 'scope' | 'status' | 'auditType' | 'auditStage' | 'auditDays' | 'auditTeam'
    | 'auditPlan' | 'plannedStartDate' | 'plannedEndDate' | 'actualStartDate'
    | 'actualEndDate' | 'leadAuditorId' | 'managementRepresentativeName'
    | 'confidentiality' | 'programmeId'>> & {
    completedAt?: string | null;
    reportIssuedAt?: string | null;
  },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.scope !== undefined) row.scope = patch.scope;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.auditType !== undefined) row.audit_type = patch.auditType;
  if (patch.auditStage !== undefined) row.audit_stage = patch.auditStage;
  if (patch.auditDays !== undefined) row.audit_days = patch.auditDays;
  if (patch.auditTeam !== undefined) row.audit_team = patch.auditTeam;
  if (patch.auditPlan !== undefined) row.audit_plan = patch.auditPlan;
  if (patch.plannedStartDate !== undefined) row.planned_start_date = patch.plannedStartDate;
  if (patch.plannedEndDate !== undefined) row.planned_end_date = patch.plannedEndDate;
  if (patch.actualStartDate !== undefined) row.actual_start_date = patch.actualStartDate ?? null;
  if (patch.actualEndDate !== undefined) row.actual_end_date = patch.actualEndDate ?? null;
  if (patch.leadAuditorId !== undefined) row.lead_auditor_id = patch.leadAuditorId || null;
  if (patch.managementRepresentativeName !== undefined) {
    row.management_representative_name = patch.managementRepresentativeName;
  }
  if (patch.confidentiality !== undefined) row.confidentiality = patch.confidentiality;
  if (patch.programmeId !== undefined) row.programme_id = patch.programmeId ?? null;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  if (patch.reportIssuedAt !== undefined) row.report_issued_at = patch.reportIssuedAt;
  if (Object.keys(row).length === 0) return;

  const { error } = await createClient()
    .from('audits')
    .update(row)
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', auditId);
  if (error) throw error;
}

/**
 * Raises a corrective action against a finding.
 *
 * Before this, nothing in the product could create a corrective action or move
 * one to `submitted` — so `record_effectiveness_review`, which only accepts a
 * CA already in `submitted`/`accepted`/`rejected`, could never succeed on
 * product-created data, the reminder and escalation jobs operated on an
 * always-empty set, and a nonconformity raised in this tool could never be
 * closed. ISO 19011 §6.7 follow-up was entirely unreachable.
 */
export async function insertCorrectiveAction(
  tenantId: string,
  ca: Omit<CorrectiveAction, 'tenantId' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const { error } = await createClient().from('corrective_actions').insert({
    id: ca.id,
    tenant_id: requireTenantId(tenantId),
    client_id: ca.clientId,
    audit_id: ca.auditId,
    finding_id: ca.findingId,
    ca_number: ca.caNumber,
    title: ca.title,
    root_cause_method: ca.rootCauseMethod,
    root_cause_analysis: ca.rootCauseAnalysis,
    immediate_action: ca.immediateAction,
    corrective_action: ca.correctiveAction,
    preventive_action: ca.preventiveAction,
    effectiveness_check: ca.effectivenessCheck,
    effectiveness_check_date: ca.effectivenessCheckDate ?? null,
    responsible_person_name: ca.responsiblePersonName,
    responsible_person_email: ca.responsiblePersonEmail,
    target_date: ca.targetDate,
    closure_evidence_ids: ca.closureEvidenceIds,
    status: ca.status,
    // `history` is jsonb and `mapCAHistory` reads each timestamp back with
    // `new Date(entry.timestamp)`. Writing the app-level `Timestamp` object
    // straight through would persist `{seconds, nanoseconds}` — its `toDate`
    // and `toMillis` methods do not survive JSON — and the reader would then
    // produce an Invalid Date. Serialize to the shape the mapper expects.
    history: ca.history.map((entry) => ({
      timestamp: entry.timestamp.toDate().toISOString(),
      action: entry.action,
      performedBy: entry.performedBy,
      notes: entry.notes ?? null,
    })),
  });
  if (error) throw error;
}

/**
 * Submits a corrective action for the auditor's effectiveness review.
 *
 * Appends to `history` rather than replacing it, and stamps `submitted_date`,
 * because `record_effectiveness_review` gates on the status this sets.
 */
export async function submitCorrectiveAction(
  tenantId: string,
  caId: string,
  submittedBy: string,
): Promise<void> {
  const supabase = createClient();
  const { data: existing, error: readError } = await supabase
    .from('corrective_actions')
    .select('history')
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', caId)
    .single();
  if (readError) throw readError;

  const history = Array.isArray(existing?.history) ? existing.history : [];
  const { error } = await supabase
    .from('corrective_actions')
    .update({
      status: 'submitted',
      submitted_date: new Date().toISOString().slice(0, 10),
      history: [
        ...history,
        {
          timestamp: new Date().toISOString(),
          action: 'submitted',
          performedBy: submittedBy,
          notes: 'Root cause analysis and action plan submitted for review.',
        },
      ],
    })
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', caId);
  if (error) throw error;
}

export async function updateCorrectiveAction(
  tenantId: string,
  caId: string,
  patch: Partial<Pick<CorrectiveAction,
    | 'title' | 'rootCauseMethod' | 'rootCauseAnalysis' | 'immediateAction'
    | 'correctiveAction' | 'preventiveAction' | 'effectivenessCheck'
    | 'responsiblePersonName' | 'responsiblePersonEmail' | 'targetDate'
    | 'closureNotes'>>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.rootCauseMethod !== undefined) row.root_cause_method = patch.rootCauseMethod;
  if (patch.rootCauseAnalysis !== undefined) row.root_cause_analysis = patch.rootCauseAnalysis;
  if (patch.immediateAction !== undefined) row.immediate_action = patch.immediateAction;
  if (patch.correctiveAction !== undefined) row.corrective_action = patch.correctiveAction;
  if (patch.preventiveAction !== undefined) row.preventive_action = patch.preventiveAction;
  if (patch.effectivenessCheck !== undefined) row.effectiveness_check = patch.effectivenessCheck;
  if (patch.responsiblePersonName !== undefined) row.responsible_person_name = patch.responsiblePersonName;
  if (patch.responsiblePersonEmail !== undefined) row.responsible_person_email = patch.responsiblePersonEmail;
  if (patch.targetDate !== undefined) row.target_date = patch.targetDate;
  if (patch.closureNotes !== undefined) row.closure_notes = patch.closureNotes;
  if (Object.keys(row).length === 0) return;

  const { error } = await createClient()
    .from('corrective_actions')
    .update(row)
    .eq('tenant_id', requireTenantId(tenantId))
    .eq('id', caId);
  if (error) throw error;
}

export async function insertAudit(tenantId: string, audit: Audit): Promise<void> {
  const { error } = await createClient().from('audits').insert({
    id: audit.id,
    tenant_id: requireTenantId(tenantId),
    client_id: audit.clientId,
    programme_id: audit.programmeId ?? null,
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
    // Findings raised on the web carried NO deadline at all: this column was
    // read by the row mapper and written by nothing, so every web-raised
    // nonconformity was untracked by the reminder and escalation jobs.
    target_closure_date: finding.targetClosureDate ?? null,
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
