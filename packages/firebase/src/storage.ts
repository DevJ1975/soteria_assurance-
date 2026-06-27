/**
 * Tenant-scoped Firebase Storage helpers for audit evidence.
 *
 * SOTERIA RULE 2 — storage object paths are rooted under the tenant and audit
 * (`tenants/{tenantId}/audits/{auditId}/evidence/…`), mirroring the Firestore
 * hierarchy so storage security rules can enforce the same isolation.
 *
 * @packageDocumentation
 */

import {
  type FullMetadata,
  type StorageReference,
  type UploadMetadata,
  type UploadResult,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { getFirebaseStorage } from './config';

function requireSegment(value: string, label: string): string {
  if (value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

/**
 * Sanitises a file name into a single safe path segment: strips any directory
 * separators so a caller cannot escape the tenant/audit prefix.
 */
function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/[\\/]+/g, '_').trim();
  if (base === '') {
    throw new Error('fileName must be a non-empty string.');
  }
  return base;
}

/**
 * Builds the tenant-scoped storage path for an evidence file:
 * `tenants/{tenantId}/audits/{auditId}/evidence/{fileName}`.
 */
export function evidencePath(tenantId: string, auditId: string, fileName: string): string {
  return [
    'tenants',
    requireSegment(tenantId, 'tenantId'),
    'audits',
    requireSegment(auditId, 'auditId'),
    'evidence',
    sanitizeFileName(fileName),
  ].join('/');
}

/** Returns a {@link StorageReference} for an evidence file's tenant-scoped path. */
export function evidenceRef(
  tenantId: string,
  auditId: string,
  fileName: string,
): StorageReference {
  return ref(getFirebaseStorage(), evidencePath(tenantId, auditId, fileName));
}

/**
 * Uploads an evidence file to its tenant-scoped path.
 *
 * Accepts the binary payload types the modular Storage SDK supports
 * (`Blob`/`Uint8Array`/`ArrayBuffer`), so it works on both web (`File`/`Blob`)
 * and React Native (`Blob` from a local URI fetch).
 */
export function uploadEvidence(
  tenantId: string,
  auditId: string,
  fileName: string,
  data: Blob | Uint8Array | ArrayBuffer,
  metadata?: UploadMetadata,
): Promise<UploadResult> {
  const reference = evidenceRef(tenantId, auditId, fileName);
  return metadata === undefined
    ? uploadBytes(reference, data)
    : uploadBytes(reference, data, metadata);
}

/** Resolves a public download URL for an evidence file. */
export function getDownloadUrl(
  tenantId: string,
  auditId: string,
  fileName: string,
): Promise<string> {
  return getDownloadURL(evidenceRef(tenantId, auditId, fileName));
}

/** Resolves a public download URL for an arbitrary, already-built storage path. */
export function getDownloadUrlForPath(path: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), requireSegment(path, 'path')));
}

export type { FullMetadata, StorageReference, UploadMetadata, UploadResult };
