/**
 * `setTenantClaims` callable — sets the tenant-isolation custom claims on a
 * target user's Firebase Auth record.
 *
 * SOTERIA RULE 2/3 — claims are the backbone of tenant isolation. Only a
 * `tenant_admin` (within their own tenant) or a `super_admin` may set them, and
 * a `tenant_admin` may NEVER grant a role above their own nor target a user in
 * another tenant. Permissions are derived from the canonical RBAC matrix in
 * `@soteria/core` (never hand-rolled here).
 *
 * @packageDocumentation
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
  ROLE_PERMISSIONS,
  type FirebaseCustomClaims,
  type UserRole,
} from '@soteria/core';
import { requireAuth } from '../common/guards';
import { getAdminAuth } from '../common/admin';

/** Tenant categories accepted in claims. */
export type ClaimTenantType = FirebaseCustomClaims['tenantType'];

const TENANT_TYPES: readonly ClaimTenantType[] = ['cb', 'consultancy', 'enterprise'];

const VALID_ROLES: readonly UserRole[] = [
  'super_admin',
  'tenant_admin',
  'lead_auditor',
  'auditor',
  'auditee',
  'viewer',
];

/** Wire payload for `setTenantClaims`. */
export interface SetTenantClaimsPayload {
  /** UID of the user whose claims are being set. */
  targetUid: string;
  tenantId: string;
  tenantType: ClaimTenantType;
  role: UserRole;
  /** Client orgs this user may access (optional). */
  clientIds?: string[];
}

/** Successful response. */
export interface SetTenantClaimsResult {
  targetUid: string;
  claims: FirebaseCustomClaims;
}

function assertPayload(data: unknown): SetTenantClaimsPayload {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Request body is required.');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['targetUid'] !== 'string' || (d['targetUid'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: targetUid.');
  }
  if (typeof d['tenantId'] !== 'string' || (d['tenantId'] as string).length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantId.');
  }
  const tenantType = d['tenantType'];
  if (
    typeof tenantType !== 'string' ||
    !(TENANT_TYPES as readonly string[]).includes(tenantType)
  ) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: tenantType.');
  }
  const role = d['role'];
  if (typeof role !== 'string' || !(VALID_ROLES as readonly string[]).includes(role)) {
    throw new HttpsError('invalid-argument', 'Missing or invalid field: role.');
  }
  const rawClientIds = d['clientIds'];
  const clientIds = Array.isArray(rawClientIds)
    ? rawClientIds.filter((c): c is string => typeof c === 'string')
    : undefined;

  return {
    targetUid: d['targetUid'] as string,
    tenantId: d['tenantId'] as string,
    tenantType: tenantType as ClaimTenantType,
    role: role as UserRole,
    ...(clientIds !== undefined ? { clientIds } : {}),
  };
}

/** Core handler, exported for unit testing. */
export async function handleSetTenantClaims(
  request: CallableRequest<unknown>,
): Promise<SetTenantClaimsResult> {
  const payload = assertPayload(request.data);
  const caller = requireAuth(request);

  const isSuperAdmin = caller.role === 'super_admin';
  const isTenantAdmin = caller.role === 'tenant_admin';

  if (!isSuperAdmin && !isTenantAdmin) {
    throw new HttpsError(
      'permission-denied',
      'Only tenant administrators may set user claims.',
    );
  }

  // A tenant_admin is confined to their own tenant and may not mint super_admins.
  if (isTenantAdmin) {
    if (caller.tenantId !== payload.tenantId) {
      throw new HttpsError('permission-denied', 'Cannot set claims outside your tenant.');
    }
    if (payload.role === 'super_admin') {
      throw new HttpsError('permission-denied', 'Cannot grant super_admin role.');
    }
  }

  const permissions: string[] = [...ROLE_PERMISSIONS[payload.role]];
  const claims: FirebaseCustomClaims = {
    tenantId: payload.tenantId,
    tenantType: payload.tenantType,
    role: payload.role,
    permissions,
    ...(payload.clientIds !== undefined ? { clientIds: payload.clientIds } : {}),
  };

  // Custom claims must be a plain JSON object; FirebaseCustomClaims is exactly
  // that shape, so the spread is safe.
  await getAdminAuth().setCustomUserClaims(payload.targetUid, { ...claims });

  return { targetUid: payload.targetUid, claims };
}

/** Callable export. */
export const setTenantClaims = onCall({ timeoutSeconds: 30 }, handleSetTenantClaims);
