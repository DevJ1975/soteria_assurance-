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

export async function createCompany(input: {
  name: string;
  type: AdminTenant['type'];
}): Promise<void> {
  const { error } = await createClient().from('tenants').insert({
    name: input.name.trim(),
    type: input.type,
  });
  if (error) throw error;
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
  const { error } = await createClient()
    .from('auditor_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw error;
}
