/**
 * WatermelonDB schema — the on-device SQLite mirror of the tenant-scoped
 * Firestore collections (DESIGN_DOC §5.4 / §11 offline-first).
 *
 * Every audit-scoped table carries:
 *  - `tenant_id`   — preserves tenant isolation locally (RULE 2 mirror).
 *  - `sync_status` — one of {@link SyncStatus}; drives the bidirectional sync
 *                    manager and the header sync indicator (§11).
 *  - `remote_id`   — the Firestore document id once the record has been pushed
 *                    (a locally-created record starts with only its Watermelon
 *                    id and gains a `remote_id` after its first successful push).
 *
 * Rich nested fields (audit plan, sub-clause notes, attendees, …) are stored
 * as JSON strings in `*_json` columns and (de)serialised in the model layer,
 * keeping the relational schema flat while preserving the full @soteria/core
 * shape on round-trip.
 */
import { appSchema, tableSchema } from '@nozbe/watermelondb';

/** Local sync lifecycle state for a record (mirrors §11 sync indicator). */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export const TABLE_AUDITS = 'audits';
export const TABLE_CLAUSE_ASSESSMENTS = 'clause_assessments';
export const TABLE_FINDINGS = 'findings';
export const TABLE_EVIDENCE = 'evidence';

export const mySchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TABLE_AUDITS,
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'audit_number', type: 'string' },
        { name: 'audit_type', type: 'string' },
        { name: 'audit_stage', type: 'string' },
        { name: 'standard', type: 'string' },
        { name: 'scope', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'lead_auditor_id', type: 'string', isIndexed: true },
        { name: 'management_representative_name', type: 'string' },
        { name: 'planned_start_date', type: 'string' },
        { name: 'planned_end_date', type: 'string' },
        { name: 'audit_days', type: 'number' },
        { name: 'confidentiality', type: 'string' },
        { name: 'ai_readiness_score', type: 'number', isOptional: true },
        // JSON blobs for the rich nested shapes (team, plan, sites, findings summary).
        { name: 'audit_team_json', type: 'string' },
        { name: 'sites_in_scope_json', type: 'string' },
        { name: 'audit_plan_json', type: 'string' },
        { name: 'findings_summary_json', type: 'string' },
        { name: 'ai_risk_flags_json', type: 'string', isOptional: true },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'local_updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_CLAUSE_ASSESSMENTS,
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'audit_id', type: 'string', isIndexed: true },
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'clause_number', type: 'string', isIndexed: true },
        { name: 'clause_title', type: 'string' },
        { name: 'assigned_auditor_id', type: 'string' },
        { name: 'conformity_status', type: 'string', isIndexed: true },
        { name: 'score', type: 'number' },
        { name: 'auditor_notes', type: 'string' },
        { name: 'ai_generated_summary', type: 'string', isOptional: true },
        { name: 'evidence_ids_json', type: 'string' },
        { name: 'finding_ids_json', type: 'string' },
        { name: 'sub_clause_notes_json', type: 'string' },
        { name: 'is_complete', type: 'boolean' },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'local_updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_FINDINGS,
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'audit_id', type: 'string', isIndexed: true },
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'client_id', type: 'string', isIndexed: true },
        { name: 'finding_number', type: 'string' },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'severity', type: 'string', isOptional: true },
        { name: 'clause_number', type: 'string', isIndexed: true },
        { name: 'clause_title', type: 'string' },
        { name: 'requirement', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'objective_evidence', type: 'string' },
        { name: 'nonconformity_statement', type: 'string' },
        { name: 'ai_draft_statement', type: 'string', isOptional: true },
        { name: 'department', type: 'string', isOptional: true },
        { name: 'area', type: 'string', isOptional: true },
        { name: 'evidence_ids_json', type: 'string' },
        { name: 'raised_by_auditor_id', type: 'string' },
        { name: 'raised_by_auditor_name', type: 'string' },
        { name: 'raised_at', type: 'number' },
        { name: 'target_closure_date', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'local_updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: TABLE_EVIDENCE,
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'audit_id', type: 'string', isIndexed: true },
        { name: 'tenant_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        // Local file URI (pre-upload) and remote download URL (post-upload).
        { name: 'local_uri', type: 'string', isOptional: true },
        { name: 'file_url', type: 'string' },
        { name: 'file_name', type: 'string' },
        { name: 'file_size', type: 'number' },
        { name: 'mime_type', type: 'string' },
        { name: 'thumbnail_url', type: 'string', isOptional: true },
        { name: 'captured_at', type: 'number' },
        { name: 'captured_by_auditor_id', type: 'string' },
        { name: 'geo_location_json', type: 'string', isOptional: true },
        { name: 'clause_numbers_json', type: 'string' },
        { name: 'finding_ids_json', type: 'string' },
        { name: 'is_verified', type: 'boolean' },
        // Tracks the file-upload phase distinct from the doc sync phase.
        { name: 'upload_status', type: 'string', isIndexed: true },
        { name: 'sync_status', type: 'string', isIndexed: true },
        { name: 'local_created_at', type: 'number' },
        { name: 'local_updated_at', type: 'number' },
      ],
    }),
  ],
});
