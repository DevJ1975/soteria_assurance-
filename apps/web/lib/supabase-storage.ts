import { createClient } from '@/utils/supabase/client';

/**
 * The private buckets created in
 * `supabase/migrations/20260912050000_audit_clause_storage.sql`. Their storage
 * policies all require the first path segment to be the caller's tenant id, so
 * every path this module builds must start with it.
 */
export type StorageBucket =
  | 'evidence'
  | 'signatures'
  | 'reports'
  | 'corrective-action-evidence';

/** How long a generated download link stays valid, in seconds. */
const SIGNED_URL_TTL_SECONDS = 300;

function requireTenantId(tenantId: string): string {
  if (tenantId.trim() === '') {
    throw new Error('A tenant id is required for this operation.');
  }
  return tenantId;
}

/**
 * Strips a filename down to characters that survive a URL round-trip. Storage
 * keys are path-like, so a name containing `/` or `..` would otherwise land the
 * object outside its tenant prefix and be rejected by the bucket policy.
 */
function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+/, '');
  return cleaned === '' ? 'file' : cleaned.slice(0, 120);
}

/**
 * Builds a storage key of the form `<tenant-id>/<segment>/…/<file>`.
 *
 * The tenant id is always the first segment because the storage RLS policies
 * compare it against `current_tenant_id()`. A path built any other way is
 * rejected by the database, not silently written somewhere unreadable.
 */
export function buildTenantObjectPath(
  tenantId: string,
  segments: string[],
  fileName: string,
): string {
  const safeSegments = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
    .map((segment) => encodeURIComponent(segment));
  return [requireTenantId(tenantId), ...safeSegments, sanitizeFileName(fileName)].join('/');
}

export interface UploadFileInput {
  bucket: StorageBucket;
  tenantId: string;
  /** Path segments between the tenant prefix and the file, e.g. `[auditId]`. */
  segments: string[];
  file: File;
}

export interface UploadedObject {
  bucket: StorageBucket;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Uploads a file into a private bucket under the caller's tenant prefix.
 *
 * A random id is prepended to the filename so two auditors uploading
 * `photo.jpg` for the same audit do not overwrite each other; `upsert` stays
 * off so a collision surfaces as an error rather than as lost evidence.
 */
export async function uploadTenantFile({
  bucket,
  tenantId,
  segments,
  file,
}: UploadFileInput): Promise<UploadedObject> {
  const path = buildTenantObjectPath(
    tenantId,
    segments,
    `${crypto.randomUUID()}-${file.name}`,
  );
  const { error } = await createClient()
    .storage.from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return {
    bucket,
    path,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}

/**
 * Returns a short-lived download URL for a private object. These buckets are
 * not public, so this is the only way to read an object from the browser, and
 * the link expires rather than becoming a permanent shareable handle.
 */
export async function createSignedDownloadUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Removes an object. The bucket policy limits this to the owning tenant. */
export async function removeTenantFile(bucket: StorageBucket, path: string): Promise<void> {
  const { error } = await createClient().storage.from(bucket).remove([path]);
  if (error) throw error;
}
