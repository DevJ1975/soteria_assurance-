/**
 * Shared authentication / tenant-isolation guards for callable functions.
 *
 * SOTERIA RULE 2 — every callable that touches tenant data verifies the
 * caller's Firebase custom claims here before any Firestore access. The
 * `tenantId` in the request payload MUST match the `tenantId` claim baked into
 * the caller's JWT, otherwise the request is rejected with `permission-denied`.
 *
 * @packageDocumentation
 */

import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { UserRole } from '@soteria/core';

/**
 * The subset of a verified Firebase JWT we rely on. Custom claims are typed
 * loosely on the SDK (`Record<string, unknown>`); we narrow them here.
 */
export interface VerifiedAuth {
  uid: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  tenantType?: string;
  clientIds?: string[];
}

const VALID_ROLES: readonly UserRole[] = [
  'super_admin',
  'tenant_admin',
  'lead_auditor',
  'auditor',
  'auditee',
  'viewer',
];

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

/**
 * Asserts the request is authenticated and returns the narrowed claims.
 *
 * @throws {HttpsError} `unauthenticated` when there is no auth context.
 * @throws {HttpsError} `permission-denied` when required claims are absent.
 */
export function requireAuth(request: CallableRequest<unknown>): VerifiedAuth {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const token = request.auth.token;
  const tenantId = token['tenantId'];
  const role = token['role'];

  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new HttpsError('permission-denied', 'Missing tenant claim.');
  }
  if (!isUserRole(role)) {
    throw new HttpsError('permission-denied', 'Missing or invalid role claim.');
  }

  const rawPermissions = token['permissions'];
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions.filter((p): p is string => typeof p === 'string')
    : [];

  const tenantType = typeof token['tenantType'] === 'string' ? token['tenantType'] : undefined;
  const rawClientIds = token['clientIds'];
  const clientIds = Array.isArray(rawClientIds)
    ? rawClientIds.filter((c): c is string => typeof c === 'string')
    : undefined;

  return {
    uid: request.auth.uid,
    tenantId,
    role,
    permissions,
    ...(tenantType !== undefined ? { tenantType } : {}),
    ...(clientIds !== undefined ? { clientIds } : {}),
  };
}

/**
 * Asserts the caller's tenant claim matches the `tenantId` supplied in the
 * request payload. Returns the verified auth for convenience.
 *
 * @throws {HttpsError} `permission-denied` on mismatch.
 */
export function requireTenantMatch(
  request: CallableRequest<unknown>,
  tenantId: string,
): VerifiedAuth {
  const auth = requireAuth(request);
  if (auth.tenantId !== tenantId) {
    throw new HttpsError('permission-denied', 'Tenant mismatch.');
  }
  return auth;
}

/**
 * Asserts the caller holds the named permission string.
 *
 * @throws {HttpsError} `permission-denied` when the permission is absent.
 */
export function requirePermission(auth: VerifiedAuth, permission: string): void {
  if (!auth.permissions.includes(permission)) {
    throw new HttpsError('permission-denied', `Missing permission: ${permission}.`);
  }
}

// ---------------------------------------------------------------------------
// Payload field validation — every callable bounds its inputs so a client can
// never ship unbounded strings (or oversized base64 blobs) into a prompt.
// ---------------------------------------------------------------------------

/** Cap for short identifier-ish fields (clause numbers, titles, roles). */
export const MAX_SHORT_FIELD_LENGTH = 256;

/** Cap for freeform text fields (notes, summaries, org context). */
export const MAX_TEXT_FIELD_LENGTH = 16_384;

/**
 * Reads a required string field, enforcing non-emptiness and a length cap.
 *
 * @throws {HttpsError} `invalid-argument` when missing, wrong-typed, empty or
 *   longer than `maxLength`.
 */
export function requireString(
  data: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpsError('invalid-argument', `Missing or invalid field: ${key}.`);
  }
  if (value.length > maxLength) {
    throw new HttpsError(
      'invalid-argument',
      `Field too long: ${key} (max ${maxLength} characters).`,
    );
  }
  return value;
}

/**
 * Reads an optional string field, enforcing the length cap when present.
 * Returns `undefined` when the field is absent or not a string.
 */
export function optionalString(
  data: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined {
  const value = data[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value.length > maxLength) {
    throw new HttpsError(
      'invalid-argument',
      `Field too long: ${key} (max ${maxLength} characters).`,
    );
  }
  return value;
}
