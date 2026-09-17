/**
 * Privilege escalation through `profiles`.
 *
 * This is a regression test for a live vulnerability: `users_can_update_own_
 * profile` had no WITH CHECK, so Postgres reused the USING expression and
 * constrained `id` alone — leaving `role` writable by its owner, which is the
 * exact column `is_super_admin()` reads. Two PATCHes turned any provisioned
 * user into a platform administrator.
 *
 * If these ever fail again, every superadmin policy is decorative.
 */
import {
  admin,
  createActor,
  createTenant,
  destroyTenant,
  uniqueEmail,
  type Actor,
} from './helpers/stack';

describe('profile privilege escalation', () => {
  let tenantA: string;
  let tenantB: string;
  let viewer: Actor;

  beforeAll(async () => {
    tenantA = await createTenant('Escalation A');
    tenantB = await createTenant('Escalation B');
    viewer = await createActor(tenantA, 'viewer', 'viewer');
  });

  afterAll(async () => {
    await destroyTenant(tenantA);
    await destroyTenant(tenantB);
  });

  it('cannot promote itself to super_admin', async () => {
    await viewer.client.from('profiles').update({ role: 'super_admin' }).eq('id', viewer.user.id);

    const { data } = await viewer.client
      .from('profiles')
      .select('role')
      .eq('id', viewer.user.id)
      .single();
    expect(data?.role).toBe('viewer');
  });

  it('cannot move itself into another tenant', async () => {
    await viewer.client.from('profiles').update({ tenant_id: tenantB }).eq('id', viewer.user.id);

    const { data } = await viewer.client
      .from('profiles')
      .select('tenant_id')
      .eq('id', viewer.user.id)
      .single();
    expect(data?.tenant_id).toBe(tenantA);
  });

  it('can still update its own display name', async () => {
    const { error } = await viewer.client
      .from('profiles')
      .update({ display_name: 'Renamed' })
      .eq('id', viewer.user.id);
    expect(error).toBeNull();

    const { data } = await viewer.client
      .from('profiles')
      .select('display_name')
      .eq('id', viewer.user.id)
      .single();
    expect(data?.display_name).toBe('Renamed');
  });

  it('sees no invitations, which carry invitee emails and granted roles', async () => {
    const { data } = await viewer.client.from('auditor_invitations').select('email');
    expect(data ?? []).toHaveLength(0);
  });
});

/**
 * Privilege escalation through `auditor_invitations`.
 *
 * Regression test for the sibling of the `profiles` bug above, and the same
 * mistake one table over: `admins_can_update_invitations` checked WHO was
 * updating but pinned no columns, so a tenant_admin could rewrite a pending
 * invitation's `email` and `role` — and `handle_invited_user` grants
 * `invitation.role` verbatim.
 *
 * Confirmed exploitable before the fix: a tenant_admin rewrote an invitation
 * to `super_admin` with an address they controlled, registered it, and
 * `is_super_admin()` returned true with every tenant on the platform readable.
 *
 * Closed in 20260916000000 by three independent layers, each of which alone
 * stops it. The tests are written per-layer on purpose: if one regresses, that
 * test fails specifically rather than being masked by the other two.
 */
describe('invitation grant integrity', () => {
  let tenantId: string;
  let tenantAdmin: Actor;
  let invitationId: string;
  let inviteeEmail: string;

  beforeAll(async () => {
    tenantId = await createTenant('Invitation Grants');
    tenantAdmin = await createActor(tenantId, 'tenant_admin', 'tadmin');
  });

  beforeEach(async () => {
    inviteeEmail = uniqueEmail('invitee');
    const { data, error } = await admin
      .from('auditor_invitations')
      .insert({
        tenant_id: tenantId,
        email: inviteeEmail,
        display_name: 'Invited Person',
        role: 'auditor',
        status: 'pending',
        invited_by: tenantAdmin.user.id,
      })
      .select('id')
      .single();
    if (error) throw error;
    invitationId = data.id as string;
  });

  afterEach(async () => {
    await admin.from('auditor_invitations').delete().eq('id', invitationId);
  });

  afterAll(async () => {
    await destroyTenant(tenantId);
  });

  it('a tenant admin cannot raise an invitation to super_admin', async () => {
    const { error } = await tenantAdmin.client
      .from('auditor_invitations')
      .update({ role: 'super_admin' })
      .eq('id', invitationId);
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('auditor_invitations')
      .select('role')
      .eq('id', invitationId)
      .single();
    expect(data?.role).toBe('auditor');
  });

  it('a tenant admin cannot redirect an invitation to another address', async () => {
    const { error } = await tenantAdmin.client
      .from('auditor_invitations')
      .update({ email: uniqueEmail('attacker') })
      .eq('id', invitationId);
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('auditor_invitations')
      .select('email')
      .eq('id', invitationId)
      .single();
    expect(data?.email).toBe(inviteeEmail);
  });

  it('a tenant admin cannot re-open a spent invitation', async () => {
    await admin
      .from('auditor_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);

    const { error } = await tenantAdmin.client
      .from('auditor_invitations')
      .update({ status: 'pending' })
      .eq('id', invitationId);
    expect(error).not.toBeNull();

    const { data } = await admin
      .from('auditor_invitations')
      .select('status')
      .eq('id', invitationId)
      .single();
    expect(data?.status).toBe('revoked');
  });

  it('a tenant admin can still revoke, which is the transition they own', async () => {
    const { error } = await tenantAdmin.client
      .from('auditor_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId);
    expect(error).toBeNull();

    const { data } = await admin
      .from('auditor_invitations')
      .select('status, revoked_at')
      .eq('id', invitationId)
      .single();
    expect(data?.status).toBe('revoked');
    expect(data?.revoked_at).not.toBeNull();
  });

  it('no invitation can grant super_admin, not even through the service role', async () => {
    // The CHECK constraint is not subject to RLS and is not bypassed by the
    // service role, so this holds regardless of which path writes the row.
    const { error } = await admin.from('auditor_invitations').insert({
      tenant_id: tenantId,
      email: uniqueEmail('platform'),
      display_name: 'Platform Admin',
      role: 'super_admin',
      status: 'pending',
      invited_by: tenantAdmin.user.id,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/role_not_super_admin|violates check constraint/i);
  });
});
