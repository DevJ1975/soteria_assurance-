import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return { url, anonKey };
}

/**
 * Resolves the Supabase URL for a SERVER-SIDE client.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is inlined into the browser bundle, so it must be
 * an origin the BROWSER can reach. When the app runs in a container next to a
 * containerized Supabase (see docker-compose.yml), those are two different
 * origins for the same service: the browser reaches it on the published host
 * port, while this process reaches it by service name on the Docker network.
 *
 * `SUPABASE_INTERNAL_URL` overrides the URL for server-side calls only. It is
 * unset everywhere except Docker, where it points at the Kong gateway, so
 * hosted and local-dev behaviour is unchanged.
 */
function resolveServerUrl(publicUrl: string): string {
  const internal = process.env.SUPABASE_INTERNAL_URL;
  return internal !== undefined && internal.trim() !== '' ? internal : publicUrl;
}

/**
 * Routes reachable without a session.
 *
 * `/auth` is on this list and must stay on it: those handlers are what turn a
 * confirmation or invitation link into a session, so gating them would mean a
 * user could never obtain the session the gate demands.
 */
const PUBLIC_PREFIXES: readonly string[] = [
  '/login',
  '/register',
  '/superadmin/login',
  '/auth',
];

function isPublicPath(pathname: string): boolean {
  // '/' is only a client-side router to /dashboard or /login; it holds nothing.
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(resolveServerUrl(url), anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() revalidates the token against the auth server rather than
  // trusting the cookie, so this both refreshes the session and answers
  // "is this caller signed in" with something worth gating on.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (user === null && !isPublicPath(pathname)) {
    // Previously this function only refreshed the session and every protected
    // route was served to anyone; RouteGuard and SuperadminGuard are documented
    // as UX gates, not the boundary. RLS still meant no data leaked, but the
    // app shell — including the existence and shape of /superadmin — was public.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.startsWith('/superadmin')
      ? '/superadmin/login'
      : '/login';
    redirectUrl.search = '';
    // So the user lands where they were going once they have signed in.
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);

    const redirect = NextResponse.redirect(redirectUrl);
    // Carry over any cookies the refresh above just rotated. Dropping them
    // would discard a newly-refreshed token and log the user out on the very
    // request that was meant to renew them.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
