/**
 * SendGrid email wrapper.
 *
 * SOTERIA RULE 3 — the SendGrid API key is referenced ONLY via
 * `defineSecret('SENDGRID_API_KEY')` and read at call time. RULE 7 — graceful
 * degradation: when the secret is unset the wrapper logs a warning and returns
 * a `skipped` result instead of throwing, so the rest of the pipeline (e.g.
 * reminder computation) still succeeds.
 *
 * The SendGrid HTTP API is called directly via `fetch` to avoid adding the
 * `@sendgrid/mail` dependency; the contract here is a thin, typed seam.
 *
 * @packageDocumentation
 */

import { SENDGRID_API_KEY } from '../common/secrets';

/** A single outbound email. */
export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  /** Plain-text body. */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

/** Result of an email send attempt. */
export type EmailResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: string };

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

/**
 * Reads the SendGrid key from Secret Manager, returning `undefined` when it is
 * not configured (rather than throwing).
 */
function readSendgridKey(): string | undefined {
  try {
    const key = SENDGRID_API_KEY.value();
    return key.length > 0 ? key : undefined;
  } catch {
    // `.value()` throws when the secret is not bound to the running function.
    return undefined;
  }
}

/**
 * Sends an email via SendGrid. Never throws — failures are returned as typed
 * `error`/`skipped` results so callers degrade gracefully.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = readSendgridKey();
  if (apiKey === undefined) {
    // eslint-disable-next-line no-console -- operational warning, not debug noise
    console.warn('SENDGRID_API_KEY is not configured; skipping email send.');
    return { status: 'skipped', reason: 'SENDGRID_API_KEY not configured' };
  }

  const contents: Array<{ type: string; value: string }> = [
    { type: 'text/plain', value: message.text },
  ];
  if (message.html) {
    contents.push({ type: 'text/html', value: message.html });
  }

  try {
    const response = await fetch(SENDGRID_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: message.from },
        subject: message.subject,
        content: contents,
      }),
    });

    if (!response.ok) {
      return { status: 'error', reason: `SendGrid responded ${response.status}` };
    }
    return { status: 'sent' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown email error';
    return { status: 'error', reason };
  }
}
