#!/usr/bin/env node
/**
 * Recreates a superadmin login against the LOCAL Supabase stack.
 *
 * `supabase db reset` drops `auth.users` along with everything else, which
 * leaves the local stack with no way into `/superadmin` — the console is
 * gated on a `super_admin` profile, and a profile can only be written by
 * someone who already has one. This script breaks that cycle with the
 * service-role key, which bypasses RLS.
 *
 * It refuses to run against anything but a loopback Supabase URL. Hosted
 * superadmins are provisioned through the invitation flow, not from a laptop.
 *
 * USAGE
 *   # credentials come from `supabase status` (never commit them)
 *   export SUPABASE_URL=http://127.0.0.1:54321
 *   export SUPABASE_SERVICE_ROLE_KEY=<local service_role key>
 *   node scripts/create-local-superadmin.mjs --email you@example.test
 *
 * The password is read from $SUPERADMIN_PASSWORD when set; otherwise a random
 * one is generated and printed once. It is never written to a file.
 *
 * FLAGS
 *   --email <addr>    Superadmin email (default: $SUPERADMIN_EMAIL)
 *   --tenant <name>   Platform tenant name (default: "Soteria Platform")
 *   --name <name>     Display name (default: derived from the email)
 */
import { randomBytes } from 'node:crypto';
import process from 'node:process';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const PLATFORM_TENANT_TYPE = 'certification_body';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith('--') ? (i += 1, next) : 'true';
  }
  return args;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/**
 * Refuses any target that is not the local Docker stack. This is the only
 * thing standing between a convenience script and a service-role write to a
 * production project, so it fails closed on anything it cannot parse.
 */
function requireLocalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail(`SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    fail(
      `Refusing to run against "${parsed.host}". This script is local-only — ` +
        'provision hosted superadmins through the invitation flow.',
    );
  }
  return parsed.origin;
}

/** Generates a password strong enough that a weak default never gets reused. */
function generatePassword() {
  return `${randomBytes(18).toString('base64url')}!aA1`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const baseUrl = requireLocalUrl(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Read it from `supabase status` and ' +
        'export it for this shell only — do not add it to any committed file.',
    );
  }

  const email = (args.email ?? process.env.SUPERADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!email) fail('Pass --email <addr> or set SUPERADMIN_EMAIL.');

  const generatedPassword = !process.env.SUPERADMIN_PASSWORD;
  const password = process.env.SUPERADMIN_PASSWORD ?? generatePassword();
  const tenantName = args.tenant ?? 'Soteria Platform';
  const displayName = args.name ?? email.split('@')[0];

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  /** Wraps fetch so a failed step reports the API's own message, not a 500. */
  async function api(path, init = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(`${init.method ?? 'GET'} ${path} \u2192 ${response.status}: ${text}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  /**
   * GoTrue exposes no lookup-by-email endpoint, so an address that already
   * exists is found by paging the admin list. Local stacks hold a handful of
   * users, so this stays cheap.
   */
  async function findUserIdByEmail(address) {
    for (let page = 1; page <= 20; page += 1) {
      const result = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
      const users = result.users ?? [];
      const match = users.find((user) => user.email?.toLowerCase() === address);
      if (match) return match.id;
      if (users.length < 200) return null;
    }
    return null;
  }

  // 1. The platform tenant. `profiles.tenant_id` is NOT NULL, so even a
  //    superadmin — whose reads go through `is_super_admin()` rather than a
  //    tenant — needs a home row.
  const existingTenants = await api(
    `/rest/v1/tenants?name=eq.${encodeURIComponent(tenantName)}&select=id&limit=1`,
  );
  let tenantId = existingTenants[0]?.id;
  if (!tenantId) {
    const [created] = await api('/rest/v1/tenants', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: tenantName, type: PLATFORM_TENANT_TYPE }),
    });
    tenantId = created.id;
    console.log(`• created platform tenant "${tenantName}"`);
  } else {
    console.log(`• reusing platform tenant "${tenantName}"`);
  }

  // 2. The auth user. Re-running the script after a partial failure must not
  //    error out, so an existing address resets the password instead.
  let userId = null;
  try {
    const created = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      }),
    });
    userId = created.id;
    console.log(`• created auth user ${email}`);
  } catch (error) {
    if (error.status !== 422 && error.status !== 400) throw error;
    userId = await findUserIdByEmail(email);
    if (!userId) throw error;
    await api(`/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    console.log(`• reset password for existing auth user ${email}`);
  }

  // 3. The profile. `handle_invited_user` only provisions invited users, so a
  //    bootstrap superadmin is written here directly.
  await api('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id: userId,
      tenant_id: tenantId,
      email,
      display_name: displayName,
      role: 'super_admin',
      is_active: true,
    }),
  });
  console.log('• profile set to role super_admin');

  console.log('\n✔ Superadmin ready — sign in at http://localhost:3000/superadmin/login');
  console.log(`  email:    ${email}`);
  if (generatedPassword) {
    console.log(`  password: ${password}`);
    console.log('\n  This password is shown once and stored nowhere. Save it now.');
  } else {
    console.log('  password: (from $SUPERADMIN_PASSWORD)');
  }
}

main().catch((error) => fail(error.message));
