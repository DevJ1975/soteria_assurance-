# @soteria/web

Phase-1 MVP web app for **Soteria Assurance** — an ISO 45001:2018 AI-powered
audit management platform. Next.js 15 (App Router), deployable to **Firebase
Hosting** as a fully **static export**.

## Stack

- Next.js `^15` (App Router), React `^19`
- Tailwind CSS `^3.4` via the shared `@soteria/ui/tailwind` preset (tokens only)
- `@tanstack/react-query` for client-side Firebase reads
- `react-hook-form` + `zod` for forms
- `firebase` `^11` through the shared `@soteria/firebase` wrapper (Auth +
  tenant-scoped Firestore + callable Cloud Functions)

## Static export (Firebase Hosting)

`next.config.mjs` sets `output: 'export'`, `images.unoptimized`,
`trailingSlash: true` and `transpilePackages` for the three `@soteria/*`
packages. The build emits `apps/web/out`, which `firebase.json` Hosting serves.

Because static export cannot resolve unknown dynamic route params, **there are no
`[id]` folder segments**. Every route is statically known and entity IDs travel
via query params read with `useSearchParams()` (wrapped in `<Suspense>`), e.g.:

- `/audits/view?id=…`
- `/audits/clauses?id=…`
- `/audits/findings?id=…`
- `/audits/report?id=…`

All data-driven pages are Client Components doing client-side Firebase reads.
There are **no** API routes, server actions or server data fetching.

## Environment

Public Firebase web config comes from `NEXT_PUBLIC_FIREBASE_*` env vars
(RULE 3 — not secret). Copy `.env.local.example` to `.env.local` and fill in.
`messagingSenderId` defaults to `830573978482`.

## Scripts

```
pnpm --filter @soteria/web dev        # next dev
pnpm --filter @soteria/web build      # next build -> out/
pnpm --filter @soteria/web typecheck  # tsc --noEmit
pnpm --filter @soteria/web lint       # next lint
pnpm --filter @soteria/web clean      # rimraf .next out
```

## Auth

Three providers via `@soteria/firebase`: email/password, Google popup, and phone
(invisible reCAPTCHA → OTP). `lib/auth-context.tsx` exposes `useAuth()` with
`user`, parsed `claims` (tenantId/role) and the auth actions.
`components/RouteGuard.tsx` redirects unauthenticated users to `/login`.

## Soteria rules honored

- TS strict everywhere; the few unavoidable casts carry inline justifications.
- Firestore access only through `@soteria/firebase` tenant-scoped helpers.
- User-facing copy from `SoteriaStrings`; ISO 45001 clause data only from
  `@soteria/core` (`getClauseTree`, `flattenClauses`, …).
- Design via the `@soteria/ui` Tailwind preset (no raw hex/spacing).
- Every major screen is wrapped in a class-based `ErrorBoundary` (RULE 8).
- AI calls (`draftNCR`, `suggestQuestions`) go to Firebase callable Cloud
  Functions and always surface the mandatory AI disclaimer.
