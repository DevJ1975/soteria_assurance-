#!/usr/bin/env node
// =============================================================================
// Soteria Assurance — Firebase project setup automation
// =============================================================================
//
// Idempotent helper that prepares a Firebase project for the Soteria Assurance
// platform (project number 830573978482). Given a resolved project, it will:
//
//   1. Ensure a WEB app is registered (firebase apps:create / apps:list).
//   2. Print the web SDK config so it can be pasted into the app .env files
//      (NEXT_PUBLIC_FIREBASE_* / EXPO_PUBLIC_FIREBASE_*). These values are
//      PUBLIC, not secret.
//   3. Enable Email/Password and Phone sign-in via the Identity Toolkit Admin
//      API (idempotent — re-running leaves an already-enabled project as is).
//   4. Note that Google sign-in additionally requires an OAuth client, which
//      must be configured in the Google Cloud / Firebase Console (the API
//      cannot mint an OAuth client). The script guides the user.
//
// SECRETS: This script NEVER reads, writes, or prints ANTHROPIC_API_KEY,
// SENDGRID_API_KEY, or any other secret. Those live exclusively in Firebase
// Secret Manager (Functions v2 defineSecret). The Firebase web SDK config it
// prints is public app configuration, not a secret.
//
// CREDENTIALS (one of):
//   * GOOGLE_APPLICATION_CREDENTIALS — path to a service-account JSON with the
//     Firebase Admin + Identity Toolkit Admin roles. Preferred for the REST
//     calls (the script mints an OAuth2 access token from it).
//   * FIREBASE_TOKEN — a CI token from `firebase login:ci`. Used for firebase
//     CLI calls. (The Identity Toolkit REST step needs a service account; if
//     only FIREBASE_TOKEN is present the script will perform CLI steps and
//     instruct the user to enable providers in the Console.)
//
// The script FAILS CLEARLY if no credentials are available.
//
// Usage:
//   node scripts/firebase-setup.mjs --project <projectId> [--app-name "Soteria Web"]
//   FIREBASE_PROJECT_ID=<projectId> node scripts/firebase-setup.mjs
//
// The project number 830573978482 is the messagingSenderId, but the firebase
// CLI / REST APIs require the textual PROJECT ID (e.g. "soteria-assurance").
// Resolve it via --project, FIREBASE_PROJECT_ID, or the active CLI project.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PROJECT_NUMBER = '830573978482'; // Also the Firebase messagingSenderId.
const WEB_APP_DISPLAY_NAME_DEFAULT = 'Soteria Web';

// ---------------------------------------------------------------------------
// Tiny logging helpers (no external deps).
// ---------------------------------------------------------------------------
const log = (msg) => process.stdout.write(`[soteria-setup] ${msg}\n`);
const warn = (msg) => process.stdout.write(`[soteria-setup] WARNING: ${msg}\n`);
const fail = (msg) => {
  process.stderr.write(`[soteria-setup] ERROR: ${msg}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Argument parsing — supports --project / --app-name and env fallbacks.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { project: undefined, appName: WEB_APP_DISPLAY_NAME_DEFAULT };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--project' || a === '-p') {
      args.project = argv[i + 1];
      i += 1;
    } else if (a === '--app-name') {
      args.appName = argv[i + 1];
      i += 1;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  log('Usage: node scripts/firebase-setup.mjs --project <projectId> [--app-name "Soteria Web"]');
  log('Resolves the project from --project, FIREBASE_PROJECT_ID, or the active firebase CLI project.');
  log(`Project number (messagingSenderId): ${PROJECT_NUMBER}`);
}

// ---------------------------------------------------------------------------
// Run the firebase CLI, returning { status, stdout, stderr }.
// Passes --token automatically when FIREBASE_TOKEN is set.
// ---------------------------------------------------------------------------
function runFirebase(cliArgs, { allowFailure = false } = {}) {
  const finalArgs = [...cliArgs];
  if (process.env.FIREBASE_TOKEN) {
    finalArgs.push('--token', process.env.FIREBASE_TOKEN);
  }
  const result = spawnSync('firebase', finalArgs, {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      fail('The firebase CLI was not found on PATH. Install it: npm i -g firebase-tools');
    }
    if (!allowFailure) fail(`firebase ${cliArgs.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFailure) {
    fail(`firebase ${cliArgs.join(' ')} exited ${result.status}:\n${result.stderr || result.stdout}`);
  }
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

// ---------------------------------------------------------------------------
// Resolve the textual project id.
// ---------------------------------------------------------------------------
function resolveProjectId(args) {
  const fromArg = args.project || process.env.FIREBASE_PROJECT_ID;
  if (fromArg) return fromArg;

  // Fall back to the active CLI project.
  const res = runFirebase(['use'], { allowFailure: true });
  const match = res.stdout.match(/Active Project:\s*\S+\s*\(([^)]+)\)/);
  if (match && match[1]) return match[1];

  fail(
    'No project id resolved. Pass --project <projectId>, set FIREBASE_PROJECT_ID, ' +
      'or run `firebase use <projectId>` first. The project NUMBER ' +
      `${PROJECT_NUMBER} is NOT accepted by the APIs — use the textual project id.`,
  );
  return ''; // unreachable
}

// ---------------------------------------------------------------------------
// Credential check. Returns { mode: 'service-account' | 'cli-token' }.
// ---------------------------------------------------------------------------
function detectCredentials() {
  const hasServiceAccount = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const hasToken = Boolean(process.env.FIREBASE_TOKEN);
  if (!hasServiceAccount && !hasToken) {
    fail(
      'No credentials found. Provide ONE of:\n' +
        '  * GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json ' +
        '(needed to enable sign-in providers via the Identity Toolkit Admin API), or\n' +
        '  * FIREBASE_TOKEN=<token from `firebase login:ci`> ' +
        '(CLI-only; provider enablement must then be done in the Console).\n' +
        'See docs/FIREBASE_SETUP.md for the three credential options.',
    );
  }
  return { mode: hasServiceAccount ? 'service-account' : 'cli-token' };
}

// ---------------------------------------------------------------------------
// Mint a Google OAuth2 access token from a service-account JSON using a signed
// JWT assertion. Avoids pulling in google-auth-library. Scope is limited to
// cloud-platform (Identity Toolkit Admin is covered by this scope).
// ---------------------------------------------------------------------------
async function getAccessTokenFromServiceAccount() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  let key;
  try {
    key = JSON.parse(readFileSync(keyPath, 'utf8'));
  } catch (err) {
    fail(`Could not read service account at GOOGLE_APPLICATION_CREDENTIALS=${keyPath}: ${err.message}`);
  }
  if (!key.client_email || !key.private_key) {
    fail('Service account JSON is missing client_email / private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64url(header)}.${b64url(claim)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!resp.ok) {
    fail(`OAuth token exchange failed (${resp.status}): ${await resp.text()}`);
  }
  const json = await resp.json();
  if (!json.access_token) fail('OAuth token exchange returned no access_token.');
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Step 1 + 2: ensure a WEB app exists and print its SDK config.
// ---------------------------------------------------------------------------
function ensureWebApp(projectId, appName) {
  log(`Ensuring a WEB app named "${appName}" exists in project ${projectId} ...`);

  // List existing apps (JSON output) and look for a WEB app.
  const listed = runFirebase(['apps:list', 'WEB', '--project', projectId, '--json'], {
    allowFailure: true,
  });

  let appId;
  try {
    const parsed = JSON.parse(listed.stdout || '{}');
    const apps = Array.isArray(parsed.result) ? parsed.result : [];
    const existing =
      apps.find((a) => a.displayName === appName) || (apps.length > 0 ? apps[0] : undefined);
    if (existing) appId = existing.appId;
  } catch {
    // Non-JSON output (older CLI) — fall through to create.
  }

  if (appId) {
    log(`Found existing WEB app: ${appId} (idempotent — not creating a new one).`);
  } else {
    log('No WEB app found — creating one ...');
    const created = runFirebase(
      ['apps:create', 'WEB', appName, '--project', projectId, '--json'],
      { allowFailure: true },
    );
    try {
      const parsed = JSON.parse(created.stdout || '{}');
      appId = parsed.result?.appId;
    } catch {
      // ignore — appId stays undefined and we surface a clear error below.
    }
    if (!appId) {
      fail(
        'Failed to create or detect a WEB app. Inspect the CLI output above. ' +
          'You can also create it manually: ' +
          `firebase apps:create WEB "${appName}" --project ${projectId}`,
      );
    }
    log(`Created WEB app: ${appId}`);
  }

  // Print the SDK config block for pasting into env files.
  log('Fetching web SDK config (PUBLIC values — safe to place in app .env files) ...');
  const sdk = runFirebase(['apps:sdkconfig', 'WEB', appId, '--project', projectId, '--json'], {
    allowFailure: true,
  });

  let config;
  try {
    const parsed = JSON.parse(sdk.stdout || '{}');
    config = parsed.result?.sdkConfig;
  } catch {
    config = undefined;
  }

  if (!config) {
    warn('Could not parse SDK config JSON. Run manually:');
    warn(`  firebase apps:sdkconfig WEB ${appId} --project ${projectId}`);
    return;
  }

  printEnvBlock(config);
}

// ---------------------------------------------------------------------------
// Emit copy-paste env blocks for both apps. messagingSenderId is the project
// number 830573978482.
// ---------------------------------------------------------------------------
function printEnvBlock(config) {
  const lines = [
    '',
    '================= WEB SDK CONFIG (PUBLIC — not secret) =================',
    '# Paste into apps/web/.env.local',
    `NEXT_PUBLIC_FIREBASE_API_KEY=${config.apiKey ?? ''}`,
    `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${config.authDomain ?? ''}`,
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${config.projectId ?? ''}`,
    `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${config.storageBucket ?? ''}`,
    `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId ?? PROJECT_NUMBER}`,
    `NEXT_PUBLIC_FIREBASE_APP_ID=${config.appId ?? ''}`,
    '',
    '# Paste into apps/mobile/.env.local',
    `EXPO_PUBLIC_FIREBASE_API_KEY=${config.apiKey ?? ''}`,
    `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=${config.authDomain ?? ''}`,
    `EXPO_PUBLIC_FIREBASE_PROJECT_ID=${config.projectId ?? ''}`,
    `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=${config.storageBucket ?? ''}`,
    `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${config.messagingSenderId ?? PROJECT_NUMBER}`,
    `EXPO_PUBLIC_FIREBASE_APP_ID=${config.appId ?? ''}`,
    '=======================================================================',
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

// ---------------------------------------------------------------------------
// Step 3: enable Email/Password and Phone sign-in via Identity Toolkit Admin.
// Requires a service-account access token. Idempotent (PATCH config).
// ---------------------------------------------------------------------------
async function enableSignInProviders(projectId) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    warn(
      'Skipping automated provider enablement — GOOGLE_APPLICATION_CREDENTIALS is not set. ' +
        'Enable Email/Password and Phone in the Console (see docs/FIREBASE_SETUP.md).',
    );
    return;
  }

  const accessToken = await getAccessTokenFromServiceAccount();

  // The Identity Toolkit Admin v2 config endpoint. We PATCH only the
  // signIn.email and signIn.phoneNumber blocks (idempotent).
  const url =
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config` +
    '?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.phoneNumber.enabled';

  const body = {
    signIn: {
      email: { enabled: true, passwordRequired: true },
      phoneNumber: { enabled: true },
    },
  };

  log('Enabling Email/Password and Phone sign-in via Identity Toolkit Admin API ...');
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    fail(
      `Failed to enable sign-in providers (${resp.status}): ${text}\n` +
        'Ensure the service account has the "Firebase Authentication Admin" role, ' +
        'or enable the providers manually in the Console.',
    );
  }
  log('Email/Password and Phone sign-in enabled (idempotent).');
}

// ---------------------------------------------------------------------------
// Step 4: Google sign-in guidance (cannot be fully automated via API).
// ---------------------------------------------------------------------------
function printGoogleSignInGuidance(projectId) {
  const lines = [
    '',
    '----- Google sign-in (manual step required) -----',
    'Google sign-in needs an OAuth 2.0 client + consent screen, which the',
    'Identity Toolkit Admin API cannot create. In the Firebase Console:',
    `  1. Open Authentication > Sign-in method for project ${projectId}.`,
    '  2. Click "Google", toggle Enable, set a support email, and Save.',
    '  3. (Web) Confirm authorized domains include your hosting domain(s).',
    '  4. (Mobile/Expo) Add the OAuth client IDs to the app config as needed.',
    '-------------------------------------------------',
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  log(`Soteria Assurance Firebase setup — project number ${PROJECT_NUMBER}.`);

  const { mode } = detectCredentials();
  log(`Credential mode: ${mode}.`);

  const projectId = resolveProjectId(args);
  log(`Resolved project id: ${projectId}`);

  // Step 1 + 2 — web app + SDK config.
  ensureWebApp(projectId, args.appName);

  // Step 3 — providers (service-account path only).
  await enableSignInProviders(projectId);

  // Step 4 — Google guidance.
  printGoogleSignInGuidance(projectId);

  log('Done. Review the env block above and paste it into the app .env.local files.');
  log('Next: run scripts/deploy.sh to build the web app and deploy hosting + rules.');
}

main().catch((err) => {
  fail(err?.stack || String(err));
});
