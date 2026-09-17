import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(resolveServerUrl(url), anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes
          // the session when this helper is called during a render.
        }
      },
    },
  });
}
