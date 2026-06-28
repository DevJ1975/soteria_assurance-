import {
  hasPermission,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  type Permission,
} from '../constants/rbac';
import type { UserRole } from '../types/user';

const ROLES: UserRole[] = [
  'super_admin',
  'tenant_admin',
  'lead_auditor',
  'auditor',
  'auditee',
  'viewer',
];

describe('ROLE_PERMISSIONS — DESIGN_DOC §7 matrix', () => {
  it('grants super_admin every permission', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission('super_admin', permission)).toBe(true);
    }
  });

  it('matches the matrix for "manage tenants" (super_admin only)', () => {
    expect(hasPermission('super_admin', 'manage_tenants')).toBe(true);
    for (const role of ROLES.filter((r) => r !== 'super_admin')) {
      expect(hasPermission(role, 'manage_tenants')).toBe(false);
    }
  });

  it('matches the matrix for "manage users" (super_admin, tenant_admin)', () => {
    expect(hasPermission('super_admin', 'manage_users')).toBe(true);
    expect(hasPermission('tenant_admin', 'manage_users')).toBe(true);
    expect(hasPermission('lead_auditor', 'manage_users')).toBe(false);
    expect(hasPermission('auditor', 'manage_users')).toBe(false);
  });

  it('matches the matrix for "create audits" (admins + lead_auditor)', () => {
    expect(hasPermission('lead_auditor', 'create_audits')).toBe(true);
    expect(hasPermission('auditor', 'create_audits')).toBe(false);
    expect(hasPermission('auditee', 'create_audits')).toBe(false);
  });

  it('matches the matrix for "conduct audits" (down to auditor)', () => {
    expect(hasPermission('auditor', 'conduct_audits')).toBe(true);
    expect(hasPermission('auditee', 'conduct_audits')).toBe(false);
    expect(hasPermission('viewer', 'conduct_audits')).toBe(false);
  });

  it('matches the matrix for "close NCs" (admins + lead_auditor)', () => {
    expect(hasPermission('lead_auditor', 'close_ncs')).toBe(true);
    expect(hasPermission('auditor', 'close_ncs')).toBe(false);
  });

  it('matches the matrix for "manage corrective actions" (down to auditee)', () => {
    expect(hasPermission('auditee', 'manage_corrective_actions')).toBe(true);
    expect(hasPermission('viewer', 'manage_corrective_actions')).toBe(false);
  });

  it('matches the matrix for "billing management" (admins only)', () => {
    expect(hasPermission('tenant_admin', 'billing_management')).toBe(true);
    expect(hasPermission('lead_auditor', 'billing_management')).toBe(false);
  });

  it('matches the matrix for "AI co-pilot" (down to auditor)', () => {
    expect(hasPermission('auditor', 'ai_copilot')).toBe(true);
    expect(hasPermission('auditee', 'ai_copilot')).toBe(false);
  });

  it('grants "view audit reports" and "export reports" to every role', () => {
    for (const role of ROLES) {
      expect(hasPermission(role, 'view_audit_reports')).toBe(true);
      expect(hasPermission(role, 'export_reports')).toBe(true);
    }
  });

  it('defines a permission list for every role', () => {
    for (const role of ROLES) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it('only references permissions that exist in ALL_PERMISSIONS', () => {
    const known = new Set<Permission>(ALL_PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });

  it('never grants more permissions to a lower-privileged role than a higher one (monotonic for the two report rights)', () => {
    expect(ROLE_PERMISSIONS.viewer.every((p) =>
      ROLE_PERMISSIONS.auditee.includes(p),
    )).toBe(true);
  });
});
