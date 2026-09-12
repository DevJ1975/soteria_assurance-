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

export async function inviteAuditor(input: {
  tenantId: string;
  email: string;
  displayName: string;
  role: AuditorInvitation['role'];
  invitedBy: string;
}): Promise<void> {
  const { error } = await createClient().from('auditor_invitations').insert({
    tenant_id: input.tenantId,
    email: input.email.trim().toLowerCase(),
    display_name: input.displayName.trim(),
    role: input.role,
    invited_by: input.invitedBy,
  });
  if (error) throw error;
}
