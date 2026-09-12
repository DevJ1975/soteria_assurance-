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
import { createActor, createTenant, destroyTenant, type Actor } from './helpers/stack';

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
