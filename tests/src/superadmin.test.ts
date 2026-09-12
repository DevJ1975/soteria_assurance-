/**
 * Platform administration and the invitation flow.
 *
 * Invitation acceptance is the one place a profile is created without a
 * superadmin doing it by hand, so it is tested through the real trigger rather
 * than by inserting a profile and asserting the insert worked.
 */
import {
  admin,
  anonClient,
  createActor,
  createTenant,
  destroyTenant,
  uniqueEmail,
  type Actor,
} from './helpers/stack';

describe('superadmin and invitations', () => {
  let platformTenant: string;
  let customerTenant: string;
  let superadmin: Actor;
  let auditor: Actor;

  beforeAll(async () => {
    platformTenant = await createTenant('Platform', 'certification_body');
    customerTenant = await createTenant('Customer');
    superadmin = await createActor(platformTenant, 'super_admin', 'super');
    auditor = await createActor(customerTenant, 'auditor', 'plain');
  });

  afterAll(async () => {
    await destroyTenant(platformTenant);
    await destroyTenant(customerTenant);
  });

  it('a superadmin sees every tenant; an auditor sees only their own', async () => {
    const { data: all } = await superadmin.client.from('tenants').select('id');
    const ids = (all ?? []).map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([platformTenant, customerTenant]));

    const { data: mine } = await auditor.client.from('tenants').select('id');
    expect((mine ?? []).map((row) => row.id)).toEqual([customerTenant]);
  });

  it('only a superadmin can create a company', async () => {
    const { error: denied } = await auditor.client
      .from('tenants')
      .insert({ name: 'Should Not Exist', type: 'enterprise' });
    expect(denied).not.toBeNull();

    const { data, error } = await superadmin.client
      .from('tenants')
      .insert({ name: `Created By Super ${Date.now()}`, type: 'consultancy' })
      .select('id')
      .single();
    expect(error).toBeNull();
    await destroyTenant(data!.id);
  });

  it('creating a company writes an audit-log entry for it', async () => {
    // Regression: log_core_table_change() read `tenant_id` from every row, but
    // public.tenants has no such column, so every tenant insert failed the
    // audit_logs NOT NULL constraint and company creation was impossible.
    const { data: tenant, error } = await superadmin.client
      .from('tenants')
      .insert({ name: `Audit Logged ${Date.now()}`, type: 'enterprise' })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { data: logs } = await admin
      .from('audit_logs')
      .select('operation')
      .eq('table_name', 'tenants')
      .eq('record_id', tenant!.id);
    expect((logs ?? []).map((row) => row.operation)).toContain('INSERT');
    await destroyTenant(tenant!.id);
  });

  it('a superadmin can change another user\'s role', async () => {
    const { error } = await superadmin.client
      .from('profiles')
      .update({ role: 'lead_auditor' })
      .eq('id', auditor.user.id);
    expect(error).toBeNull();

    const { data } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auditor.user.id)
      .single();
    expect(data?.role).toBe('lead_auditor');

    await admin.from('profiles').update({ role: 'auditor' }).eq('id', auditor.user.id);
  });

  it('an invitation provisions the profile on first sign-in', async () => {
    const email = uniqueEmail('invitee');
    const { error: inviteError } = await superadmin.client.from('auditor_invitations').insert({
      tenant_id: customerTenant,
      email,
      display_name: 'Invited Person',
      role: 'lead_auditor',
      invited_by: superadmin.user.id,
    });
    expect(inviteError).toBeNull();

    // Signing up is what fires handle_invited_user.
    const password = 'Invited-Test-Aa1!';
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', created.user!.id)
      .maybeSingle();
    expect(profile?.tenant_id).toBe(customerTenant);
    expect(profile?.role).toBe('lead_auditor');

    const { data: invitation } = await admin
      .from('auditor_invitations')
      .select('status, accepted_by')
      .eq('email', email)
      .single();
    expect(invitation?.status).toBe('accepted');
    expect(invitation?.accepted_by).toBe(created.user!.id);

    await admin.auth.admin.deleteUser(created.user!.id);
  });

  it('a revoked invitation does not provision anyone', async () => {
    const email = uniqueEmail('revoked');
    await admin.from('auditor_invitations').insert({
      tenant_id: customerTenant,
      email,
      display_name: 'Revoked Person',
      role: 'auditor',
      invited_by: superadmin.user.id,
      status: 'revoked',
    });

    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: 'Revoked-Test-Aa1!',
      email_confirm: true,
    });

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('id', created.user!.id)
      .maybeSingle();
    expect(profile).toBeNull();

    await admin.auth.admin.deleteUser(created.user!.id);
  });
});
