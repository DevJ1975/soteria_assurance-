/**
 * Centralised Firebase Secret Manager bindings (Functions v2).
 *
 * SOTERIA RULE 3 — server-only secrets are referenced ONLY through
 * `defineSecret()` here and attached to each function's `secrets` array. They
 * are never read from `process.env` at module load, never logged, and never
 * shipped to clients.
 *
 * @packageDocumentation
 */

import { defineSecret } from 'firebase-functions/params';

/** Anthropic Claude API key — used by every AI function. */
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

/** SendGrid API key — used by the email/notification functions. */
export const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
