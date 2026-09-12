/**
 * Shared request handling for Soteria Edge Functions.
 *
 * Every function is authenticated: the caller's JWT is verified against the
 * project with the anon key, and the service-role key is only ever used after
 * that check passes, for the specific writes the caller is authorised to make.
 * A function that skips this and trusts a body-supplied tenant id would let any
 * signed-in user write into any tenant.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Thrown for any condition that maps to a specific HTTP status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Server misconfigured: ${name} is not set.`);
  return value;
}

/**
 * An anonymous client, for the few auth endpoints that only exist on the
 * public API — notably `resetPasswordForEmail`, which actually delivers a
 * recovery email, where the admin API's `generateLink` only mints one.
 */
export function anonClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  });
}

/** A service-role client. Never hand this to a caller-supplied tenant id. */
export function serviceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export interface CallerProfile {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

/**
 * Verifies the bearer token and resolves the caller's profile.
 *
 * The profile — not the request body — is the source of truth for who the
 * caller is and which tenant they belong to.
 */
export async function requireCaller(request: Request): Promise<CallerProfile> {
  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (token === '') throw new HttpError(401, 'Authentication required.');

  const anonClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, 'Authentication required.');

  // Read the profile with the service client: a user whose own profile row is
  // unreadable under RLS would otherwise appear to have no role at all.
  const { data: profile, error: profileError } = await serviceClient()
    .from('profiles')
    .select('id, email, tenant_id, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, 'Could not resolve the caller profile.');
  if (!profile || !profile.is_active) throw new HttpError(403, 'No active profile for this user.');

  return {
    userId: profile.id,
    email: profile.email,
    tenantId: profile.tenant_id,
    role: profile.role,
  };
}

/** Wraps a handler so thrown {@link HttpError}s become clean JSON responses. */
export function handleRequest(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse({ error: error.message }, error.status);
      }
      // Internal errors are logged in full but never returned to the client,
      // which would leak schema and constraint details.
      console.error(error);
      return jsonResponse({ error: 'The request could not be completed.' }, 500);
    }
  };
}

export interface AuthUserSummary {
  id: string;
  email: string;
  confirmed: boolean;
}

/**
 * Finds an auth user by email address.
 *
 * The admin API exposes no lookup-by-email, so this pages the user list. It is
 * only used on the invitation path, which is not a hot code path.
 */
export async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<AuthUserSummary | null> {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new HttpError(500, 'Could not check existing accounts.');
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) {
      return {
        id: match.id,
        email: match.email ?? email,
        confirmed: Boolean(match.email_confirmed_at),
      };
    }
    if (data.users.length < 200) return null;
  }
  return null;
}
