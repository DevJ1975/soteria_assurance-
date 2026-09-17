/**
 * Exchanges a PKCE authorization code for a session.
 *
 * The sibling of `/auth/confirm`, for the other link shape GoTrue produces.
 * `@supabase/ssr` uses the PKCE flow, so links that route through GoTrue's own
 * `/auth/v1/verify` endpoint — and every OAuth provider — come back here with
 * `?code=`, not with a `token_hash`. Both shapes are in play depending on how a
 * given email template is written, so both have a handler; neither can be
 * assumed.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/** Same origin-pinning rule as /auth/confirm — `next` is caller-supplied. */
function safeNext(raw: string | null): string {
  return raw !== null && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code === null) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${safeNext(searchParams.get('next'))}`);
}
