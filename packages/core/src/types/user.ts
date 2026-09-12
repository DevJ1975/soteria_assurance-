import type { Timestamp } from './common';
import type { StandardId } from '../standards/types';

/**
 * The fixed set of roles a user can hold within a tenant.
 *
 * Mirrors the RBAC matrix in DESIGN_DOC §7.
 */
export type UserRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'lead_auditor'
  | 'auditor'
  | 'auditee'
  | 'viewer';

/**
 * The tenant scoping carried alongside a signed-in user.
 *
 * Named for what it is rather than where it came from: under Firebase these
 * were custom claims minted into the JWT, but Supabase mints no such claims —
 * they are resolved from the user's `profiles` row, which is also what RLS
 * reads. Keeping the shape means the screens did not have to change; keeping
 * the old name would have implied a JWT field that no longer exists.
 *
 * See DESIGN_DOC §7.
 */
export interface TenantClaims {
  /** Tenant id. */
  tenantId: string;
  tenantType: 'cb' | 'consultancy' | 'enterprise';
  role: UserRole;
  /** Granular permission array. */
  permissions: string[];
  /** Which client orgs this auditor can access. */
  clientIds?: string[];
}

export interface AuditorQualification {
  /** The management-system standard this qualification covers. */
  standardId: StandardId;
  level: 'lead_auditor' | 'auditor' | 'trainee';
  certBody: string;
  certNumber: string;
  /** ISO date string. */
  issuedDate: string;
  /** ISO date string. */
  expiryDate: string;
  /** Storage object path or signed URL. */
  documentUrl?: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  qualifications: AuditorQualification[];
  /** Which clients this user can access. */
  clientIds: string[];
  isActive: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
}
