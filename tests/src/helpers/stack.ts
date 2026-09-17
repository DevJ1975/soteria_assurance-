/**
 * Fixtures for tests that run against a real local Supabase stack.
 *
 * These are deliberately integration tests, not unit tests with a mocked
 * client. Almost everything worth asserting here — tenant isolation, who may
 * escalate their own role, whether an invitation actually provisions a profile
 * — is enforced by Postgres RLS and triggers. A mock would assert that the
 * mock behaves as written, which is exactly the thing that has been wrong in
 * this codebase before.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * Defaults to the API port `supabase/config.toml` actually pins (54521), not
 * the Supabase CLI's stock 54321.
 *
 * This bit: the stock default silently pointed the whole suite at whatever
 * other Supabase project happened to be running on 54321 — a real possibility
 * on a machine with more than one — and the failure surfaced as
 * "Could not find the table 'public.tenants' in the schema cache", which reads
 * like a broken migration rather than a wrong address.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54521';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see `supabase status -o env`).',
  );
}

/** Bypasses RLS. Used only to build fixtures and to clean up afterwards. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A fresh anonymous client. Each signed-in actor needs its own. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Role =
  | 'super_admin'
  | 'tenant_admin'
  | 'lead_auditor'
  | 'auditor'
  | 'auditee'
  | 'viewer';

export interface Actor {
  user: User;
  email: string;
  password: string;
  /** A client already signed in as this actor — what a real session looks like. */
  client: SupabaseClient;
}

/** Unique per run, so a failed run's leftovers never collide with the next. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@soteria.test`;
}

export async function createTenant(name: string, type = 'enterprise'): Promise<string> {
  const { data, error } = await admin
    .from('tenants')
    .insert({ name, type })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Creates a confirmed user with a profile, and returns a client signed in as
 * them.
 *
 * The profile is written with the service role rather than through the
 * invitation flow: most tests are about what a provisioned user can do, and
 * going through invitation acceptance for each would make every test depend on
 * that one flow. The invitation flow has its own test.
 */
export async function createActor(
  tenantId: string,
  role: Role,
  prefix = 'user',
): Promise<Actor> {
  const email = uniqueEmail(prefix);
  const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error('user not created');

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    tenant_id: tenantId,
    email,
    display_name: prefix,
    role,
  });
  if (profileError) throw profileError;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { user: created.user, email, password, client };
}

/** Removes a tenant and everything that cascades from it, plus its auth users. */
export async function destroyTenant(tenantId: string): Promise<void> {
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId);
  await admin.from('tenants').delete().eq('id', tenantId);
  for (const profile of profiles ?? []) {
    await admin.auth.admin.deleteUser(profile.id as string).catch(() => undefined);
  }
}

/** A minimal audit with the client and finding a test usually needs alongside. */
export async function seedAuditChain(tenantId: string): Promise<{
  clientId: string;
  auditId: string;
  findingId: string;
}> {
  const stamp = Date.now();
  const { data: client, error: clientError } = await admin
    .from('clients')
    .insert({ tenant_id: tenantId, organization_name: `Client ${stamp}` })
    .select('id')
    .single();
  if (clientError) throw clientError;

  const { data: audit, error: auditError } = await admin
    .from('audits')
    .insert({
      tenant_id: tenantId,
      client_id: client.id,
      audit_number: `AUD-${stamp}`,
      audit_type: 'surveillance',
      scope: 'Test scope',
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-01-02',
    })
    .select('id')
    .single();
  if (auditError) throw auditError;

  const { data: finding, error: findingError } = await admin
    .from('findings')
    .insert({
      tenant_id: tenantId,
      audit_id: audit.id,
      client_id: client.id,
      finding_number: `NCR-${stamp}`,
      type: 'minor_nc',
      clause_number: '6.1.2',
      clause_title: 'Hazard identification',
      requirement: 'The organization shall...',
      title: 'Test finding',
    })
    .select('id')
    .single();
  if (findingError) throw findingError;

  return { clientId: client.id, auditId: audit.id, findingId: finding.id };
}
