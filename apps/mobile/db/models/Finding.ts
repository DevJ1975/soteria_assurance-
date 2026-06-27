/**
 * WatermelonDB `Finding` model (DESIGN_DOC §5.4).
 *
 * An on-device finding (NCR / OFI / strong point / observation). Written
 * offline-first; the sync manager pushes it to the tenant-scoped
 * `findings` sub-collection.
 */
import { Model, type Relation } from '@nozbe/watermelondb';
import { date, json, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type { FindingStatus, FindingType } from '@soteria/core';
import { TABLE_AUDITS, TABLE_FINDINGS, type SyncStatus } from '../schema';
import type { Audit } from './Audit';

function identity<T>(raw: unknown): T {
  return raw as T;
}

export class Finding extends Model {
  public static override table = TABLE_FINDINGS;

  public static override associations = {
    [TABLE_AUDITS]: { type: 'belongs_to' as const, key: 'audit_id' },
  };

  @text('remote_id') public remoteId!: string | null;
  @text('audit_id') public auditId!: string;
  @text('tenant_id') public tenantId!: string;
  @text('client_id') public clientId!: string;
  @text('finding_number') public findingNumber!: string;
  @text('type') public type!: FindingType;
  @text('severity') public severity!: 'major' | 'minor' | null;
  @text('clause_number') public clauseNumber!: string;
  @text('clause_title') public clauseTitle!: string;
  @text('requirement') public requirement!: string;
  @text('title') public title!: string;
  @text('objective_evidence') public objectiveEvidence!: string;
  @text('nonconformity_statement') public nonconformityStatement!: string;
  @text('ai_draft_statement') public aiDraftStatement!: string | null;
  @text('department') public department!: string | null;
  @text('area') public area!: string | null;

  @json('evidence_ids_json', identity<string[]>) public evidenceIds!: string[];

  @text('raised_by_auditor_id') public raisedByAuditorId!: string;
  @text('raised_by_auditor_name') public raisedByAuditorName!: string;
  @date('raised_at') public raisedAt!: Date;
  @text('target_closure_date') public targetClosureDate!: string | null;
  @text('status') public status!: FindingStatus;

  @text('sync_status') public syncStatus!: SyncStatus;
  @readonly @date('local_created_at') public localCreatedAt!: Date;
  @date('local_updated_at') public localUpdatedAt!: Date;

  @relation(TABLE_AUDITS, 'audit_id') public audit!: Relation<Audit>;
}
