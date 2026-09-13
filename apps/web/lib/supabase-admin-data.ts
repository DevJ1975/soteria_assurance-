import { createClient } from '@/utils/supabase/client';

export interface AdminTenant {
  id: string;
  name: string;
  type: 'certification_body' | 'consultancy' | 'enterprise';
  subscriptionStatus: string;
  createdAt: string;
}

export interface AuditorInvitation {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: 'tenant_admin' | 'lead_auditor' | 'auditor' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
}

export async function listAdminTenants(): Promise<AdminTenant[]> {
  const { data, error } = await createClient()
    .from('tenants')
    .select('id,name,type,subscription_status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
  }));
}

export interface CreateCompanyResult {
  invited: boolean;
  emailSent: boolean;
  warning?: string;
}

/**
 * Creates a company and, when an administrator address is supplied, invites
 * them and sends the onboarding email.
 *
 * Goes through the `create-company` Edge Function rather than inserting the
 * tenant directly: sending auth mail needs the service-role key, which must
 * never reach the browser, and creating the company and its first
 * administrator in one server-side operation avoids a company nobody can sign
 * into.
 */
export async function createCompany(input: {
  name: string;
  type: AdminTenant['type'];
  adminEmail?: string;
  adminName?: string;
}): Promise<CreateCompanyResult> {
  const { data, error } = await createClient().functions.invoke('create-company', {
    body: {
      name: input.name.trim(),
      type: input.type,
      adminEmail: input.adminEmail?.trim().toLowerCase() || undefined,
      adminName: input.adminName?.trim() || undefined,
      redirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
  const result = data as CreateCompanyResult;
  return {
    invited: Boolean(result?.invited),
    emailSent: Boolean(result?.emailSent),
    warning: result?.warning,
  };
}

export async function listAuditorInvitations(): Promise<AuditorInvitation[]> {
  const { data, error } = await createClient()
    .from('auditor_invitations')
    .select('id,tenant_id,email,display_name,role,status,created_at,expires_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Invites an auditor into a tenant.
 *
 * This goes through the `invite-auditor` Edge Function rather than inserting
 * the row directly, because an invitation is only useful once the email has
 * actually been sent — and sending it needs the service-role key, which must
 * never reach the browser. The function also rejects invitations to addresses
 * that already have an account, which a client-side insert cannot check.
 */
export async function inviteAuditor(input: {
  tenantId: string;
  email: string;
  displayName: string;
  role: AuditorInvitation['role'];
}): Promise<void> {
  const { error } = await createClient().functions.invoke('invite-auditor', {
    body: {
      tenantId: input.tenantId,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      role: input.role,
      redirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
}

/**
 * Revokes a pending invitation. The database stamps `revoked_at`, and
 * `handle_invited_user` only ever matches rows still in `pending`, so an
 * invitation email already sitting in an inbox stops working immediately.
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  // Scoped to a still-pending row: `handle_invited_user` now locks and
  // re-checks the invitation before accepting it, so a revoke that lands
  // after acceptance should leave the accepted record alone rather than
  // relabel it revoked out from under a person who already got access.
  const { error } = await createClient()
    .from('auditor_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('status', 'pending');
  if (error) throw error;
}

/* ------------------------------------------------------------------ users */

export interface PlatformUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: 'super_admin' | 'tenant_admin' | 'lead_auditor' | 'auditor' | 'auditee' | 'viewer';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** A page of results plus the total, so the UI can show "showing N of M". */
export interface Page<T> {
  rows: T[];
  total: number;
}

export interface UserQuery {
  search?: string;
  tenantId?: string;
  offset?: number;
  limit?: number;
}

/**
 * Users across every tenant. Superadmin-only by RLS
 * (`super_admin_can_read_all_profiles`).
 *
 * Paged rather than fetched whole: PostgREST caps responses at `max_rows`
 * (1000 by default), so an unbounded select would silently truncate and the
 * console would show a partial list as if it were complete.
 */
export async function listPlatformUsers(query: UserQuery = {}): Promise<Page<PlatformUser>> {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;
  let request = createClient()
    .from('profiles')
    .select('id,tenant_id,email,display_name,role,is_active,last_login_at,created_at', {
      count: 'exact',
    });

  if (query.tenantId) request = request.eq('tenant_id', query.tenantId);
  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    request = request.or(`email.ilike.${term},display_name.ilike.${term}`);
  }

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    total: count ?? 0,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    })),
  };
}

/**
 * Activates or deactivates a user.
 *
 * Deactivation is the reversible alternative to deletion, and the one the
 * schema supports: `current_tenant_id()` and `is_super_admin()` both require
 * `is_active`, so an inactive profile resolves to no tenant and no role and
 * every tenant-scoped policy stops matching for them.
 */
export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await createClient()
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;
}

/** Changes a user's role. Permitted by `super_admin_can_update_profiles`. */
export async function setUserRole(userId: string, role: PlatformUser['role']): Promise<void> {
  const { error } = await createClient().from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

/* ------------------------------------------------------------- activity */

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorId: string | null;
  tableName: string;
  recordId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  createdAt: string;
}

export interface ActivityQuery {
  tenantId?: string;
  tableName?: string;
  offset?: number;
  limit?: number;
}

/**
 * The append-only change log, newest first.
 *
 * `old_data`/`new_data` are deliberately not selected: they are full row
 * snapshots and would dominate the payload. The list answers "what changed,
 * by whom, when"; a detail view can fetch one row's diff when asked.
 */
export async function listAuditLogs(query: ActivityQuery = {}): Promise<Page<AuditLogEntry>> {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;
  let request = createClient()
    .from('audit_logs')
    .select('id,tenant_id,actor_id,table_name,record_id,operation,created_at', { count: 'exact' });

  if (query.tenantId) request = request.eq('tenant_id', query.tenantId);
  if (query.tableName) request = request.eq('table_name', query.tableName);

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  return {
    total: count ?? 0,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      tableName: row.table_name,
      recordId: row.record_id,
      operation: row.operation,
      createdAt: row.created_at,
    })),
  };
}

/* ----------------------------------------------------------- tenant usage */

export interface TenantUsage {
  tenantId: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  maxAuditors: number;
  maxAuditsPerMonth: number;
  activeMembers: number;
  activeAuditors: number;
  activeAdmins: number;
}

/** Seat usage per tenant, from the `tenant_usage` view. */
export async function listTenantUsage(): Promise<TenantUsage[]> {
  const { data, error } = await createClient()
    .from('tenant_usage')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    tenantId: row.tenant_id,
    name: row.name,
    subscriptionTier: row.subscription_tier,
    subscriptionStatus: row.subscription_status,
    maxAuditors: row.max_auditors,
    maxAuditsPerMonth: row.max_audits_per_month,
    activeMembers: Number(row.active_members ?? 0),
    activeAuditors: Number(row.active_auditors ?? 0),
    activeAdmins: Number(row.active_admins ?? 0),
  }));
}

/* ------------------------------------------------------ credential actions */

/**
 * These all go through the `admin-user-action` Edge Function. Setting someone
 * else's password and sending auth mail on their behalf both require the
 * service-role key, and the function re-checks the caller's role — a valid JWT
 * proves who you are, not what you may do.
 */
async function adminUserAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().functions.invoke('admin-user-action', {
    body: { ...body, redirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
  return data as T;
}

/** Sets a user's password directly, for someone locked out of their account. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  await adminUserAction({ action: 'set_password', userId, password });
}

/** Emails a recovery link so the user chooses their own password. */
export async function sendPasswordReset(userId: string): Promise<void> {
  await adminUserAction({ action: 'send_password_reset', userId });
}

/** Re-sends a pending invitation and extends its expiry. */
export async function resendInvitation(invitationId: string): Promise<void> {
  await adminUserAction({ action: 'resend_invitation', invitationId });
}

/* -------------------------------------------------------------- onboarding */

/**
 * Marks the signed-in user's first-run onboarding complete.
 *
 * Self-written rather than set by an admin: the flag means "this person has
 * seen the welcome", which only they can attest to. `users_can_update_own_
 * profile` permits it and pins role and tenant_id, so it cannot be abused.
 */
export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await createClient()
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
