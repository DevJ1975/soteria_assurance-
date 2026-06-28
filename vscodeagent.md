# Soteria Assurance — Agent Handoff (VS Code)

> Paste this to your VS Code coding agent (Claude/Copilot/Cursor) before it starts.
> It captures the project state, conventions, gotchas, and how to build/test/deploy.

## 1. What this is

**Soteria Assurance** — an AI-powered, multi-tenant **ISO 45001:2018** occupational
health & safety **audit management platform**. Monorepo with shared TypeScript
libraries, a Firebase backend (Auth + Firestore + Cloud Functions + Hosting), a
Next.js web app, and an Expo (React Native) mobile app. Claude (Anthropic) powers
the AI features.

**Status:** Phase-1 MVP is implemented and merged to `main`. 325 unit/integration
tests pass; the web app builds to a static Firebase Hosting bundle; the mobile app
passes `tsc --noEmit`. Source of truth for the product spec: `docs/DESIGN_DOC.md`.
Agent conventions: `docs/multi-agent-guide.md`. Visual design: `docs/design-system/`.

## 2. Tech stack

- Monorepo: **pnpm** workspaces + **Turborepo**. Node **>= 20**, pnpm **10**, TypeScript **5** strict.
- Web: **Next.js 15** (App Router, **static export** for Hosting), React 19, Tailwind 3, React Query 5, Zustand, react-hook-form + zod.
- Mobile: **Expo SDK 52** (Expo Router), React Native 0.76, **WatermelonDB** (offline), Zustand, React Query.
- Backend: **Firebase** — Auth, Cloud Firestore, Cloud Functions v2 (Node 20), Storage, Hosting. **Anthropic** `@anthropic-ai/sdk` (model `claude-sonnet-4-6`).

## 3. Repo layout

```
soteria-assurance/
├── packages/
│   ├── core/        @soteria/core   — types, ISO 45001 dataset, constants, utils (CommonJS)
│   ├── ui/          @soteria/ui     — design tokens + Tailwind preset (CommonJS)
│   └── firebase/    @soteria/firebase — Firebase JS SDK wrapper, auth + tenant-scoped Firestore (ESM)
├── apps/
│   ├── web/         @soteria/web    — Next.js 15 (static export → apps/web/out)
│   └── mobile/      @soteria/mobile — Expo Router app (offline-first)
├── functions/       soteria-functions — Cloud Functions (Claude AI, rate limiting, claims, reminders)
├── firestore.rules  storage.rules  firestore.indexes.json  firebase.json  .firebaserc
├── scripts/         firebase-setup.mjs, deploy.sh
└── docs/            DESIGN_DOC.md, multi-agent-guide.md, FIREBASE_SETUP.md, design-system/
```

## 4. Setup & common commands (run from repo root)

```bash
pnpm install                          # install all workspaces
pnpm build                            # turbo build (core → ui/firebase → functions)
pnpm test                             # turbo test — 325 tests across the 4 packages
pnpm --filter @soteria/core test      # one package
pnpm --filter @soteria/web build      # produce apps/web/out (needs apps/web/.env.local, see §6)
pnpm --filter @soteria/web dev        # next dev (localhost:3000)
pnpm --filter @soteria/mobile typecheck
```

Per-package scripts: `build` (tsc / next build), `test` (jest), `lint`, `typecheck`, `clean`.

## 5. Non-negotiable conventions (enforce these in every change)

1. **TypeScript strict.** Never `any` / `as any` / `@ts-ignore` without an inline comment justifying it. ESLint bans `@typescript-eslint/no-explicit-any`.
2. **Tenant isolation.** Every Firestore access goes through `@soteria/firebase` tenant-scoped helpers — paths are always `tenants/{tenantId}/…`. Never query a root collection.
3. **Secrets** (`ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`) live ONLY in Firebase Secret Manager via `defineSecret()` in functions. The Firebase **web** config (apiKey/appId/etc.) is public and comes from env (`NEXT_PUBLIC_FIREBASE_*` / `EXPO_PUBLIC_FIREBASE_*`).
4. **User-facing strings** come from `@soteria/core` `SoteriaStrings` (no hardcoded UI copy).
5. **ISO 45001 clause data** comes ONLY from `@soteria/core/iso45001` (`ISO45001_CLAUSES` + helpers). Never hardcode clause numbers/titles/requirement text.
6. **Design tokens** from `@soteria/ui` (`SoteriaTokens`; web uses the `@soteria/ui/tailwind` preset). No raw hex/spacing in components.
7. **Tests** for every function (Jest). Keep them green before committing. **Conventional Commits** messages (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`).
8. **Error boundaries** wrap every major screen (web `ErrorBoundary`, mobile `AuditErrorBoundary` which checkpoints to AsyncStorage). An audit in progress must never white-screen.
9. **Offline-first (mobile):** mutations write to WatermelonDB first; `syncManager` pushes to Firestore in the background. Never block a UI action on a network call.
10. AI calls go through Cloud Functions only — never call Anthropic from the client. AI output is stored in separate `aiDraft*` fields, never auto-writing auditor-confirmed fields; every AI response carries the disclaimer string.

## 6. Firebase

- **Project ID:** `soteria-assurance` (project **number** `830573978482` = `messagingSenderId`).
- **Web app:** registered. **Sign-in providers enabled:** Email/Password, Google, Phone.
- **Web env** — create `apps/web/.env.local` (git-ignored; public config, safe to share):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAzHMCTtib0EO8jUtXzjHpGWJ5lDG0QqDM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=soteria-assurance.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=soteria-assurance
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=soteria-assurance.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=830573978482
NEXT_PUBLIC_FIREBASE_APP_ID=1:830573978482:web:c31a63b040a0c4e58973eb
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ESK8SHNXK7
```

- **Mobile env** — `apps/mobile/.env` with the same values but `EXPO_PUBLIC_FIREBASE_*` prefixes.
- Local emulators: set `NEXT_PUBLIC_USE_EMULATOR=true` (or `EXPO_…`) and run `firebase emulators:start`.

### Deploy

```bash
npm i -g firebase-tools                     # one time
firebase login
pnpm --filter @soteria/web build            # → apps/web/out (needs .env.local above)
firebase deploy --only hosting --project soteria-assurance
# → live at https://soteria-assurance.web.app
```

Rules (free): `firebase deploy --only firestore:rules,firestore:indexes,storage --project soteria-assurance`
Functions (needs Blaze plan + secrets):
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set SENDGRID_API_KEY   # optional
firebase deploy --only functions --project soteria-assurance
```
One-shot: `bash scripts/deploy.sh --only hosting --project soteria-assurance`. Full runbook: `docs/FIREBASE_SETUP.md`.

## 7. Gotchas (don't re-break these)

- **Module formats are intentional:** `@soteria/core` and `@soteria/ui` emit **CommonJS** (consumed by Node/Functions/Jest); `@soteria/firebase` is **ESM** (needs bundler resolution for `firebase/*` subpaths). Don't "unify" them without testing functions + jest + web build.
- **Never let `tsc` emit into `src/`.** Library builds output to `dist/` (functions → `lib/`). A `.gitignore` guard blocks compiled files under `packages/*/src`. If jest suddenly loads stale `.js` from a source dir, delete strays.
- **Web is static export (`output: 'export'`).** No server components data-fetching, no API routes, no server actions. Entity IDs travel via **query params** (`useSearchParams()` inside `<Suspense>`), NOT `[id]` dynamic segments. `firebase.json` hosting uses `trailingSlash: true`, `cleanUrls: false`, and **no** catch-all rewrite.
- **Mobile** correctly uses Expo Router `[auditId]` dynamic routes (fine for native; only web needed query params). It was verified with `tsc --noEmit` against shimmed RN/Expo types — a full EAS native build hasn't been run here.
- **Firestore Timestamp:** `@soteria/core` defines a structural `Timestamp` interface (no firebase import) so both client and admin Timestamps are assignable.

## 8. Done vs. follow-ups

**Implemented:** auth + multi-tenant (3 providers, custom claims via `setTenantClaims`), clients, audit creation/planning, clause-by-clause assessment (full ISO 45001 dataset), findings (MNC/NC/OFI/SP) + AI draft, evidence capture (mobile), offline sync (mobile), AI co-pilot (`draftNCR`/`suggestQuestions`), tenant-isolated rules, Hosting build.

**Follow-ups (good next tasks):**
- Audit report **PDF** rendering (Puppeteer) — `functions/src/audit/generateReport.ts` assembles data + HTML; PDF is stubbed.
- Opening/Closing **meeting audio** recording + transcription — model + screens exist; capture/transcribe pending.
- **E2E** suites — Playwright (web) and Detox (mobile).
- Broaden **functions** test coverage toward the 85% target; add Firestore **rules** tests (emulator).
- Native iOS/Android **EAS** build + store config.
- Wire **Firebase Analytics** in the web app using `getFirebaseMeasurementId()`.

## 9. Working agreement for the agent

- Read `docs/DESIGN_DOC.md` (data model §8, features §9, AI §10) and `docs/multi-agent-guide.md` before non-trivial work.
- Stay within a package's domain; import shared code from `@soteria/*` (don't duplicate types/ISO data/strings/tokens).
- Run `pnpm test` and the relevant `build`/`typecheck` before committing. Keep commits Conventional and scoped.
- Don't commit secrets or `.env*` (except `.env.example`). The web Firebase config is public but kept in git-ignored `.env.local` to avoid secret-scanner noise.
