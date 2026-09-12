/**
 * Sign-in, session and onboarding state.
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

describe('authentication', () => {
  let tenantId: string;
  let auditor: Actor;

  beforeAll(async () => {
    tenantId = await createTenant('Auth Tenant');
    auditor = await createActor(tenantId, 'auditor', 'auth-auditor');
  });

  afterAll(async () => {
    await destroyTenant(tenantId);
  });

  it('signs in with a correct password and resolves the profile', async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: auditor.email,
      password: auditor.password,
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();

    const { data: profile } = await client
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', auditor.user.id)
      .single();
    expect(profile?.tenant_id).toBe(tenantId);
    expect(profile?.role).toBe('auditor');
  });

  it('rejects a wrong password', async () => {
    const { error } = await anonClient().auth.signInWithPassword({
      email: auditor.email,
      password: 'definitely-not-the-password',
    });
    expect(error).not.toBeNull();
  });

  it('refreshes a session', async () => {
    const client = anonClient();
    await client.auth.signInWithPassword({
      email: auditor.email,
      password: auditor.password,
    });
    const { data, error } = await client.auth.refreshSession();
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  it('signing out revokes the session\'s access to tenant data', async () => {
    const client = anonClient();
    await client.auth.signInWithPassword({
      email: auditor.email,
      password: auditor.password,
    });
    await client.auth.signOut();

    const { data: user } = await client.auth.getUser();
    expect(user.user).toBeNull();

    // An anonymous caller matches no tenant, so RLS returns nothing.
    const { data } = await client.from('clients').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('a user with no profile gets no tenant, rather than a default one', async () => {
    // Exactly what signing up without an invitation produces. The app shows an
    // organization-pending state; the database must back that up by resolving
    // no tenant at all rather than falling through to one.
    const email = uniqueEmail('orphan');
    const password = 'Orphan-Test-Aa1!';
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    const client = anonClient();
    await client.auth.signInWithPassword({ email, password });

    const { data: profile } = await client
      .from('profiles')
      .select('tenant_id')
      .eq('id', created.user!.id)
      .maybeSingle();
    expect(profile).toBeNull();

    const { data: clients } = await client.from('clients').select('id');
    expect(clients ?? []).toHaveLength(0);

    await admin.auth.admin.deleteUser(created.user!.id);
  });
});
