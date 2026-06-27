/**
 * WatermelonDB `ClauseAssessment` model (DESIGN_DOC §5.4).
 *
 * The on-device assessment of a single ISO 45001 clause within an audit. The
 * sub-clause interview notes are stored as a JSON blob and rehydrated into the
 * `@soteria/core` {@link SubClauseNote} array.
 */
import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, json, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type { ConformityStatus, SubClauseNote } from '@soteria/core';
import { TABLE_AUDITS, TABLE_CLAUSE_ASSESSMENTS, type SyncStatus } from '../schema';
import type { Audit } from './Audit';

function identity<T>(raw: unknown): T {
  return raw as T;
}

export class ClauseAssessment extends Model {
  public static override table = TABLE_CLAUSE_ASSESSMENTS;

  public static override associations = {
    [TABLE_AUDITS]: { type: 'belongs_to' as const, key: 'audit_id' },
  };

  @text('remote_id') public remoteId!: string | null;
  @text('audit_id') public auditId!: string;
  @text('tenant_id') public tenantId!: string;
  @text('clause_number') public clauseNumber!: string;
  @text('clause_title') public clauseTitle!: string;
  @text('assigned_auditor_id') public assignedAuditorId!: string;
  @text('conformity_status') public conformityStatus!: ConformityStatus;
  @field('score') public score!: number;
  @text('auditor_notes') public auditorNotes!: string;
  @text('ai_generated_summary') public aiGeneratedSummary!: string | null;

  @json('evidence_ids_json', identity<string[]>) public evidenceIds!: string[];
  @json('finding_ids_json', identity<string[]>) public findingIds!: string[];
  @json('sub_clause_notes_json', identity<SubClauseNote[]>) public subClauseNotes!: SubClauseNote[];

  @field('is_complete') public isComplete!: boolean;

  @text('sync_status') public syncStatus!: SyncStatus;
  @readonly @date('local_created_at') public localCreatedAt!: Date;
  @date('local_updated_at') public localUpdatedAt!: Date;

  @relation(TABLE_AUDITS, 'audit_id') public audit!: Relation<Audit>;
}
