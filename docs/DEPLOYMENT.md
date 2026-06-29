# Deployment — Soteria Assurance

Two web-hosting targets are supported (DESIGN_DOC §16: "Web — Vercel or Firebase
Hosting"). The Next.js app is a **fully static export** (`output: 'export'`), so
the same `apps/web/out/` bundle deploys to either.

- **Firebase Hosting** — wired via `.github/workflows/deploy-hosting.yml` + `firebase.json` `hosting`.
- **Vercel** — wired via `vercel.json` (this document).

---

## Vercel hosting (web app)

The repo root `vercel.json` makes the monorepo deploy as a static site:

```jsonc
{
  "framework": null,                                        // serve the static export directly
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm turbo run build --filter=@soteria/web...", // builds workspace deps first
  "outputDirectory": "apps/web/out",                        // Next.js static export output
  "ignoreCommand": "npx --yes turbo-ignore @soteria/web"    // skip deploys when web is untouched
}
```

Why these choices:

- **`framework: null` + `outputDirectory: apps/web/out`** — the app is a static
  export (every route is statically known; entity ids travel via query params).
  Serving `out/` directly is identical to how Firebase Hosting serves it.
- **`buildCommand` via Turbo with `--filter=@soteria/web...`** — the `...` builds
  `@soteria/web` **and its workspace dependencies** (`@soteria/core`, `ui`,
  `firebase`), which resolve via their `dist/` entry points.
- **`turbo.json` `outputs` includes `out/**`** — required so a Turbo **cache hit**
  restores the static export. Without it, a cached build would deploy an empty
  site.

### One-time setup

1. **Import the repo** at <https://vercel.com/new> (Vercel auto-detects pnpm +
   `vercel.json`). Leave **Root Directory** as the repo root.
2. **Add environment variables** (Project → Settings → Environment Variables) —
   the public Firebase web config (same values as the GitHub Actions repo
   variables used by Firebase Hosting CI):

   | Variable | Required |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ |
   | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | optional (Analytics) |

   These are **public** client keys (not secrets) — `ANTHROPIC_API_KEY` /
   `SENDGRID_API_KEY` stay in Firebase Secret Manager and are never set here.

   > Build-time guard: `apps/web/next.config.mjs` **fails the build** on a Vercel
   > production/preview deploy when any required key above is missing (listing the
   > exact missing names), so a misconfigured deploy fails fast instead of
   > white-screening at runtime. Local / CI / Firebase-Hosting builds only warn
   > and still succeed; set `SOTERIA_SKIP_ENV_CHECK=1` to bypass.
3. **Authorize the Vercel domain** in Firebase Auth → Settings → Authorized
   domains (so sign-in works from the `*.vercel.app` / custom domain).

### Deploy

Pushing to the connected branch deploys automatically. Or from the CLI:

```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production deploy
```

> Note: AI co-pilot, report generation, and notifications run in **Firebase
> Functions**, called from the client via `httpsCallable`. They deploy
> independently of the web host — Vercel serves only the static front-end.

---

## Firebase Data Connect (Cloud SQL) — optional relational layer

See [`dataconnect/README.md`](../dataconnect/README.md). Summary: an additive
PostgreSQL/GraphQL projection of the domain for relational reporting, alongside
(not replacing) Firestore. Provisioning needs GCP billing:

```bash
firebase init dataconnect          # link/create Cloud SQL instance
firebase dataconnect:sdk:generate  # generate the typed client SDK
firebase deploy --only dataconnect # apply schema + connectors
```
