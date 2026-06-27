import type { UserRole } from '../types/user';

/**
 * The complete set of granular permissions, transcribed from the RBAC matrix
 * in DESIGN_DOC §7.
 */
export type Permission =
  | 'manage_tenants'
  | 'manage_users'
  | 'create_audits'
  | 'conduct_audits'
  | 'add_findings'
  | 'view_audit_reports'
  | 'close_ncs'
  | 'manage_corrective_actions'
  | 'billing_management'
  | 'ai_copilot'
  | 'export_reports';

/**
 * Ordered list of every permission (matches the rows of the §7 RBAC matrix).
 */
export const ALL_PERMISSIONS: readonly Permission[] = [
  'manage_tenants',
  'manage_users',
  'create_audits',
  'conduct_audits',
  'add_findings',
  'view_audit_reports',
  'close_ncs',
  'manage_corrective_actions',
  'billing_management',
  'ai_copilot',
  'export_reports',
] as const;

/**
 * Role → permission mapping, transcribed exactly from the DESIGN_DOC §7
 * RBAC matrix.
 *
 * | Permission                | SA | TA | LA | AU | AE | VW |
 * |---------------------------|----|----|----|----|----|----|
 * | Manage tenants            | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
 * | Manage users              | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
 * | Create audits             | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
 * | Conduct audits            | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
 * | Add findings              | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
 * | View audit reports        | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
 * | Close NCs                 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
 * | Manage corrective actions | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
 * | Billing management        | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
 * | AI co-pilot               | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
 * | Export reports            | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'manage_tenants',
    'manage_users',
    'create_audits',
    'conduct_audits',
    'add_findings',
    'view_audit_reports',
    'close_ncs',
    'manage_corrective_actions',
    'billing_management',
    'ai_copilot',
    'export_reports',
  ],
  tenant_admin: [
    'manage_users',
    'create_audits',
    'conduct_audits',
    'add_findings',
    'view_audit_reports',
    'close_ncs',
    'manage_corrective_actions',
    'billing_management',
    'ai_copilot',
    'export_reports',
  ],
  lead_auditor: [
    'create_audits',
    'conduct_audits',
    'add_findings',
    'view_audit_reports',
    'close_ncs',
    'manage_corrective_actions',
    'ai_copilot',
    'export_reports',
  ],
  auditor: [
    'conduct_audits',
    'add_findings',
    'view_audit_reports',
    'manage_corrective_actions',
    'ai_copilot',
    'export_reports',
  ],
  auditee: [
    'view_audit_reports',
    'manage_corrective_actions',
    'export_reports',
  ],
  viewer: ['view_audit_reports', 'export_reports'],
};

/**
 * Returns `true` when `role` is granted `permission`.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
