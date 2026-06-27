# Firebase Setup & Deployment Runbook — Soteria Assurance

ISO 45001:2018 AI-Powered Audit Management Platform.

- **Firebase project number:** `830573978482` (this is also the
  `messagingSenderId`).
- **Textual project id:** resolved at setup time (e.g. `soteria-assurance`). The
  Firebase CLI and REST APIs require the **textual project id**, not the number.
  Drive everything from `--project <projectId>` / `FIREBASE_PROJECT_ID` / the
  active CLI project.

> Secrets warning: `ANTHROPIC_API_KEY` and `SENDGRID_API_KEY` live **only** in
> Firebase Secret Manager (Functions v2 `defineSecret()`). They must never go
> in `.env.local`, client config, this repo, or any command output. The Firebase
> **web SDK config** (`apiKey`, `appId`, etc.) is **not secret** — it is public
> client configuration and belongs in the app `.env.local` files.

---

## 1. Prerequisites

- Node.js >= 20 and pnpm (`packageManager: pnpm@10.x`).
- Firebase CLI: `npm i -g firebase-tools` (v13+).
- Access to the Firebase project `830573978482` with at least the
  **Firebase Admin** and **Firebase Authentication Admin** roles.
- (For provider automation) the **Identity Toolkit API** enabled on the GCP
  project.

Confirm the CLI sees the project:

```bash
firebase login          # interactive, local dev
firebase projects:list
firebase use <projectId> # sets the active project for this repo
```

---

## 2. Credential options (pick ONE)

The automation script (`scripts/firebase-setup.mjs`) and `scripts/deploy.sh`
both need credentials. Three options:

### Option A — Service account (recommended for full automation)

Grants the script permission to enable sign-in providers via the Identity
Toolkit Admin API (Option B / C cannot do this automatically).

1. In the Firebase Console: **Project settings → Service accounts → Generate
   new private key**. Save the JSON **outside** the repo.
2. Ensure the service account has roles **Firebase Authentication Admin** and
   **Firebase Admin** (or broader **Editor**).
3. Export the path:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/soteria-sa.json
   ```

### Option B — CI token (`FIREBASE_TOKEN`)

Good for CI deploys and CLI app registration. Cannot enable providers via REST
— do the provider steps in the Console (section 4).

```bash
firebase login:ci          # prints a token
export FIREBASE_TOKEN=1//...
```

### Option C — Console by hand

No script credentials. Do every step manually in the Firebase Console
(sections 3–5). Use this if you cannot obtain a service account or CI token.

The setup script **fails clearly** if neither `GOOGLE_APPLICATION_CREDENTIALS`
nor `FIREBASE_TOKEN` is set.

---

## 3. Register the web app & capture config

### Automated

```bash
# With credentials exported (section 2):
node scripts/firebase-setup.mjs --project <projectId> --app-name "Soteria Web"
```

The script will:

1. Ensure a **WEB** app named "Soteria Web" exists (idempotent).
2. Print a copy-paste env block for both apps (web + mobile).
3. Enable **Email/Password** and **Phone** sign-in (service-account path only).
4. Print **Google sign-in** manual guidance.

### By hand (Console)

1. **Project settings → General → Your apps → Add app → Web (`</>`)**.
2. Name it "Soteria Web", register, and copy the `firebaseConfig` object.
3. Map the values to env keys (section 6).

You can re-fetch the config any time:

```bash
firebase apps:list WEB --project <projectId>
firebase apps:sdkconfig WEB <appId> --project <projectId>
```

---

## 4. Enable sign-in providers

Soteria supports **Email/Password**, **Google**, and **Phone** (web uses
`RecaptchaVerifier` for Phone).

### Email/Password + Phone

- **Automated (service account):** `scripts/firebase-setup.mjs` enables both via
  the Identity Toolkit Admin API (idempotent PATCH).
- **By hand:** Console → **Authentication → Sign-in method**:
  - **Email/Password** → Enable → Save.
  - **Phone** → Enable → Save. (Add test numbers if needed for development.)

### Google (manual — always)

Google sign-in needs an OAuth 2.0 client + consent screen, which the API cannot
mint. In the Console:

1. **Authentication → Sign-in method → Google → Enable.**
2. Set a **support email** and Save.
3. **Web:** ensure your hosting domain(s) are listed under
   **Authentication → Settings → Authorized domains**.
4. **Mobile/Expo:** add the generated OAuth client IDs to the Expo/native config
   as required by your auth library.

---

## 5. Configure Functions secrets (one-time, before deploying Functions)

Secrets are stored in Firebase Secret Manager and referenced by Functions v2
via `defineSecret()`:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY  --project <projectId>
firebase functions:secrets:set SENDGRID_API_KEY   --project <projectId>
```

Never place these in `.env.local`, `.env.example`, or any committed file.

---

## 6. Where to paste the web config (`.env.local`)

The web SDK config is public. Create app-local env files (git-ignored):

`apps/web/.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=830573978482
NEXT_PUBLIC_FIREBASE_APP_ID=<appId>
```

`apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=<apiKey>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<authDomain>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<storageBucket>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=830573978482
EXPO_PUBLIC_FIREBASE_APP_ID=<appId>
```

The canonical key list is in the repo root `.env.example` (public keys only).

---

## 7. Local development with emulators

`firebase.json` configures the emulator suite:

| Emulator   | Port |
| ---------- | ---- |
| Auth       | 9099 |
| Firestore  | 8080 |
| Functions  | 5001 |
| Hosting    | 5000 |
| Storage    | 9199 |
| Emulator UI| enabled (auto port) |

```bash
firebase emulators:start --project <projectId>
```

Rules (`firestore.rules`, `storage.rules`) and indexes
(`firestore.indexes.json`) are loaded automatically.

---

## 8. Deploying

### Web app build target

Hosting serves the Next.js **static export** at `apps/web/out`. The web app must
set `output: 'export'` in `next.config` so the build emits `apps/web/out`.

### One command (build web + deploy everything)

```bash
# Local (after `firebase login`) or CI (with FIREBASE_TOKEN exported):
scripts/deploy.sh --project <projectId>
```

`scripts/deploy.sh` runs, in order:

1. `firestore:rules,firestore:indexes,storage` (rules + indexes).
2. `functions` (the `firebase.json` predeploy hook builds `functions/`).
3. `hosting:web` (after `pnpm build:web` produces `apps/web/out`).

### Targeted deploys

```bash
scripts/deploy.sh --only rules      --project <projectId>
scripts/deploy.sh --only functions  --project <projectId>
scripts/deploy.sh --only hosting    --project <projectId>
```

### Raw CLI equivalents

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project <projectId>
firebase deploy --only functions --project <projectId>
firebase deploy --only hosting:web --project <projectId>
```

---

## 9. Verification checklist

- [ ] Web app registered; config pasted into `apps/web/.env.local`.
- [ ] Email/Password, Google, Phone all show **Enabled** in the Console.
- [ ] `ANTHROPIC_API_KEY` and `SENDGRID_API_KEY` set in Secret Manager (not in any file).
- [ ] `firebase deploy --only firestore:rules` succeeds (rules compile).
- [ ] Hosting deploy publishes `apps/web/out` and the SPA rewrite serves routes.
- [ ] Tenant isolation verified: a token with tenant A cannot read tenant B.

---

## 10. Troubleshooting

- **"No project id resolved"** — pass `--project <projectId>` or run
  `firebase use <projectId>`. The project **number** `830573978482` is not
  accepted by the APIs.
- **Provider enablement 403** — the service account lacks
  **Firebase Authentication Admin**; grant it or enable providers in the Console.
- **`apps/web/out` missing** — the web app is not configured for static export;
  set `output: 'export'` in `next.config`.
- **Functions deploy fails on build** — run `pnpm --filter soteria-functions build`
  locally to see the TypeScript error; the predeploy hook runs the same build.
