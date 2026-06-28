import type { Timestamp } from './common';

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
 * Custom claims embedded in every Firebase Auth JWT for tenant isolation.
 *
 * See DESIGN_DOC §7 (Firebase Custom Claims).
 */
export interface FirebaseCustomClaims {
  /** Tenant document ID. */
  tenantId: string;
  tenantType: 'cb' | 'consultancy' | 'enterprise';
  role: UserRole;
  /** Granular permission array. */
  permissions: string[];
  /** Which client orgs this auditor can access. */
  clientIds?: string[];
}

export interface AuditorQualification {
  /** e.g. "ISO 45001:2018". */
  standard: string;
  level: 'lead_auditor' | 'auditor' | 'trainee';
  certBody: string;
  certNumber: string;
  /** ISO date string. */
  issuedDate: string;
  /** ISO date string. */
  expiryDate: string;
  /** Firebase Storage URL. */
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
