/**
 * Evidence and report objects in Supabase Storage.
 *
 * Every bucket is private, so nothing here returns a permanent URL. Reads go
 * through a short-lived signed URL, and the durable reference stored on a
 * record is the object path — which must begin with the tenant id, because
 * that prefix is exactly what the storage policies check.
 */
import { supabase } from './supabase';

/** Seconds a signed download link stays valid. */
const SIGNED_URL_TTL = 300;

/**
 * Builds the object path for a piece of evidence.
 *
 * `<tenant>/<audit>/<file>` — the leading tenant segment is load-bearing:
 * `storage.foldername(name)[1]` is compared against the caller's tenant by
 * every policy on the bucket.
 */
export function evidenceObjectPath(
  tenantId: string,
  auditId: string,
  fileName: string,
): string {
  return `${tenantId}/${auditId}/${fileName}`;
}

/** Uploads an evidence file read from the device cache. */
export async function uploadEvidence(params: {
  tenantId: string;
  auditId: string;
  fileName: string;
  mimeType: string;
  body: ArrayBuffer | Blob | Uint8Array;
}): Promise<string> {
  const path = evidenceObjectPath(params.tenantId, params.auditId, params.fileName);
  const { error } = await supabase.storage
    .from('evidence')
    .upload(path, params.body, { contentType: params.mimeType, upsert: true });
  if (error) throw error;
  return path;
}

/** A short-lived download URL for a private object. */
export async function getDownloadUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) throw error;
  return data.signedUrl;
}

/** A short-lived download URL for a generated report. */
export async function getDownloadUrlForPath(path: string): Promise<string> {
  return getDownloadUrl('reports', path);
}
