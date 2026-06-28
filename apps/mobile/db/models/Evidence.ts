/**
 * WatermelonDB `Evidence` model (DESIGN_DOC §5.4 / §5.5).
 *
 * Field evidence captured offline. `localUri` points at the on-device file
 * (a compressed photo from {@link evidenceService}); `fileUrl` is populated
 * once the background upload to tenant-scoped Storage succeeds. `uploadStatus`
 * tracks the file-upload phase independently of the document `syncStatus`.
 */
import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, json, readonly, relation, text } from '@nozbe/watermelondb/decorators';
import type { EvidenceGeoLocation, EvidenceType } from '@soteria/core';
import { TABLE_AUDITS, TABLE_EVIDENCE, type SyncStatus } from '../schema';
import type { Audit } from './Audit';

function identity<T>(raw: unknown): T {
  return raw as T;
}

/** Upload phase of an evidence file's binary payload. */
export type UploadStatus = 'local_only' | 'uploading' | 'uploaded' | 'failed';

export class Evidence extends Model {
  public static override table = TABLE_EVIDENCE;

  public static override associations = {
    [TABLE_AUDITS]: { type: 'belongs_to' as const, key: 'audit_id' },
  };

  @text('remote_id') public remoteId!: string | null;
  @text('audit_id') public auditId!: string;
  @text('tenant_id') public tenantId!: string;
  @text('type') public type!: EvidenceType;
  @text('title') public title!: string;
  @text('description') public description!: string;
  @text('local_uri') public localUri!: string | null;
  @text('file_url') public fileUrl!: string;
  @text('file_name') public fileName!: string;
  @field('file_size') public fileSize!: number;
  @text('mime_type') public mimeType!: string;
  @text('thumbnail_url') public thumbnailUrl!: string | null;
  @date('captured_at') public capturedAt!: Date;
  @text('captured_by_auditor_id') public capturedByAuditorId!: string;

  @json('geo_location_json', identity<EvidenceGeoLocation | null>)
  public geoLocation!: EvidenceGeoLocation | null;
  @json('clause_numbers_json', identity<string[]>) public clauseNumbers!: string[];
  @json('finding_ids_json', identity<string[]>) public findingIds!: string[];

  @field('is_verified') public isVerified!: boolean;
  @text('upload_status') public uploadStatus!: UploadStatus;

  @text('sync_status') public syncStatus!: SyncStatus;
  @readonly @date('local_created_at') public localCreatedAt!: Date;
  @date('local_updated_at') public localUpdatedAt!: Date;

  @relation(TABLE_AUDITS, 'audit_id') public audit!: Relation<Audit>;
}
