/**
 * Turns an emailed one-time link into a session.
 *
 * This is where every `token_hash` link GoTrue sends lands: signup
 * confirmation, auditor invitation, password recovery and email change. Before
 * this route existed the app had no such endpoint at all, which is part of why
 * `enable_confirmations` was off — with confirmations on and nothing to receive
 * the link, a new auditor could confirm their address and still have no way to
 * reach a signed-in session.
 *
 * Runs on the server so the verified session is written straight into the
 * cookie jar the middleware and Server Components read, rather than being
 * parsed out of a URL fragment by client JavaScript.
 */
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * The OTP types this route will act on.
 *
 * An allow-list rather than a cast: `type` arrives from the query string, and
 * handing an arbitrary caller-supplied string to `verifyOtp` lets someone probe
 * flows this app does not use.
 */
const HANDLED_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

/**
 * Where to send someone once their link checks out.
 *
 * `next` comes from the URL, so it is only honoured when it is a path on this
 * origin. Without that check the confirmation link doubles as an open redirect:
 * a link that genuinely came from Soteria, and genuinely signs you in, that
 * hands you to someone else's page afterwards.
 */
function safeNext(raw: string | null, type: string): string {
  if (raw !== null && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }
  // A recovery link is the one case where the destination is not the app
  // proper: the point of following it is to set a new password.
  return type === 'recovery' ? '/settings?reset=1' : '/dashboard';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (tokenHash === null || type === null || !HANDLED_TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });

  if (error) {
    // The two cases a person actually hits are "already used" and "expired",
    // and both want the same next step: ask for another link. The specific
    // GoTrue message is not surfaced — it distinguishes a real address from an
    // unknown one.
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${safeNext(searchParams.get('next'), type)}`);
}
