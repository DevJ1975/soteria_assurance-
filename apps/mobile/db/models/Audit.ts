/**
 * WatermelonDB `Audit` model (DESIGN_DOC §5.4).
 *
 * Maps the flat SQLite columns from {@link mySchema} to typed accessors and
 * (de)serialises the JSON-blob columns into the rich `@soteria/core` nested
 * shapes ({@link AuditTeamMember}, {@link AuditPlan}, {@link AuditFindingsSummary}).
 */
import { Model } from '@nozbe/watermelondb';
import { date, field, json, readonly, text } from '@nozbe/watermelondb/decorators';
import type {
  AuditFindingsSummary,
  AuditPlan,
  AuditStage,
  AuditStatus,
  AuditTeamMember,
  AuditType,
} from '@soteria/core';
import { TABLE_AUDITS, type SyncStatus } from '../schema';

/** Identity sanitiser for `@json` columns: trust the stored shape as `T`. */
function identity<T>(raw: unknown): T {
  // The blob is always written by our own serialisers, so the round-trip is
  // structurally safe; this cast is the documented WatermelonDB @json pattern.
  return raw as T;
}

export class Audit extends Model {
  public static override table = TABLE_AUDITS;

  @text('remote_id') public remoteId!: string | null;
  @text('tenant_id') public tenantId!: string;
  @text('client_id') public clientId!: string;
  @text('audit_number') public auditNumber!: string;
  @text('audit_type') public auditType!: AuditType;
  @text('audit_stage') public auditStage!: AuditStage;
  @text('standard') public standard!: string;
  @text('scope') public scope!: string;
  @text('status') public status!: AuditStatus;
  @text('lead_auditor_id') public leadAuditorId!: string;
  @text('management_representative_name') public managementRepresentativeName!: string;
  @text('planned_start_date') public plannedStartDate!: string;
  @text('planned_end_date') public plannedEndDate!: string;
  @field('audit_days') public auditDays!: number;
  @text('confidentiality') public confidentiality!: 'standard' | 'restricted';
  @field('ai_readiness_score') public aiReadinessScore!: number | null;

  @json('audit_team_json', identity<AuditTeamMember[]>) public auditTeam!: AuditTeamMember[];
  @json('sites_in_scope_json', identity<string[]>) public sitesInScope!: string[];
  @json('audit_plan_json', identity<AuditPlan>) public auditPlan!: AuditPlan;
  @json('findings_summary_json', identity<AuditFindingsSummary>)
  public findingsSummary!: AuditFindingsSummary;
  @json('ai_risk_flags_json', identity<string[]>) public aiRiskFlags!: string[] | null;

  @text('sync_status') public syncStatus!: SyncStatus;
  @readonly @date('local_created_at') public localCreatedAt!: Date;
  @date('local_updated_at') public localUpdatedAt!: Date;
}
