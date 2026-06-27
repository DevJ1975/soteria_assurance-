# Soteria Assurance

> ISO 45001:2018 AI-powered audit management platform — built by Trainovate Technologies.

Soteria Assurance is a mobile-first, offline-capable platform for occupational
health & safety (OH&S) auditors. It guides a lead auditor clause-by-clause
through the full ISO 45001:2018 standard, captures photo/audio evidence in the
field, records findings (MNC / NC / OFI / SP), and uses an AI Co-Pilot (powered
by the Anthropic Claude API) to draft nonconformity reports and suggest
interview questions. Multi-tenant by design, it serves certification bodies,
consultancies, and in-house audit teams.

---

## Monorepo structure

```
soteria-assurance/
├── package.json                ← Root workspace (pnpm + Turborepo)
├── pnpm-workspace.yaml
├── turbo.json                  ← Turborepo task graph
├── tsconfig.base.json          ← Shared strict TS compiler options + path aliases
├── eslint.config.mjs           ← Flat ESLint config (no-explicit-any: error)
├── .prettierrc.json
├── .env.example                ← Public env var KEYS only (no secrets)
│
├── packages/
│   ├── core/                   ← @soteria/core — dependency-free business logic
│   │   └── src/
│   │       ├── types/          ← All TypeScript interfaces (DESIGN_DOC §8)
│   │       ├── constants/      ← strings.ts + finding/enum constants
│   │       ├── utils/          ← Date helpers, validators
│   │       ├── hooks/          ← Shared React hooks
│   │       └── iso45001/       ← Canonical ISO 45001 clause data
│   ├── ui/                     ← @soteria/ui — shared component library + tokens
│   └── firebase/               ← @soteria/firebase — Firebase config & helpers
│
├── apps/
│   ├── mobile/                 ← @soteria/mobile — React Native (Expo SDK 52)
│   └── web/                    ← @soteria/web — Next.js 15 (App Router)
│
├── functions/                  ← soteria-functions — Firebase Functions v2
│
├── firestore.rules             ← Firestore security rules (tenant isolation)
├── storage.rules               ← Firebase Storage rules
├── firebase.json               ← Firebase project config
│
└── docs/
    ├── DESIGN_DOC.md           ← Comprehensive product design document
    └── multi-agent-guide.md    ← Claude Code multi-agent contributor guide
```

---

## Tech stack

| Layer                | Technology                                            |
| -------------------- | ----------------------------------------------------- |
| Language             | TypeScript 5.x (strict mode everywhere)               |
| Mobile               | React Native 0.76+ with Expo SDK 52, Expo Router      |
| Web                  | Next.js 15 (App Router)                               |
| Mobile UI            | React Native Paper + custom components                |
| Web UI               | shadcn/ui + Tailwind CSS 3                            |
| State                | Zustand + TanStack Query v5                            |
| Forms / validation   | React Hook Form + Zod                                  |
| Offline sync         | WatermelonDB (SQLite, offline-first)                  |
| Database             | Cloud Firestore                                       |
| Auth                 | Firebase Auth (multi-tenant, JWT custom claims)       |
| Storage              | Firebase Storage                                      |
| Serverless           | Firebase Functions v2 (Node.js)                       |
| AI                   | Anthropic Claude API (claude-sonnet-4-6)              |
| Email                | SendGrid                                              |
| PDF generation       | Puppeteer (via Cloud Functions)                       |
| Monorepo / tooling   | Turborepo, pnpm, ESLint, Prettier                     |
| Testing              | Jest + Testing Library, Detox (mobile E2E), Playwright |
| CI/CD                | GitHub Actions                                        |

---

## Prerequisites

| Tool    | Version              |
| ------- | -------------------- |
| Node.js | `>=20` (see `.nvmrc`) |
| pnpm    | `10.33.0`            |

```bash
# Use the pinned Node version
nvm use            # reads .nvmrc

# Enable the pinned pnpm via Corepack
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

---

## Getting started

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Configure environment variables
cp .env.example apps/mobile/.env.local   # fill EXPO_PUBLIC_FIREBASE_* values
cp .env.example apps/web/.env.local      # fill NEXT_PUBLIC_FIREBASE_* values
# Secrets (ANTHROPIC_API_KEY, SENDGRID_API_KEY) live in Firebase Secret Manager.
```

### Common commands

| Command               | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `pnpm build`          | Build all packages and apps (`turbo run build`)      |
| `pnpm test`           | Run all test suites (`turbo run test`)               |
| `pnpm lint`           | Lint the whole monorepo                              |
| `pnpm typecheck`      | Type-check every package                             |
| `pnpm format`         | Format the repo with Prettier                        |
| `pnpm clean`          | Remove build output across the workspace             |
| `pnpm dev:web`        | Run the Next.js web app in dev mode                  |
| `pnpm dev:mobile`     | Run the Expo mobile app in dev mode                  |
| `pnpm dev:functions`  | Run Firebase Functions in dev/watch mode             |
| `pnpm test:core`      | Run only `@soteria/core` tests                       |
| `pnpm test:functions` | Run only the Functions tests                         |
| `pnpm build:web`      | Build only the web app                               |
| `pnpm build:mobile`   | Build only the mobile app                            |

> `deploy:functions`, `deploy:rules`, `deploy:web`, and `emulators` are
> placeholder scripts until the Firebase project and hosting targets are wired up.

---

## Packages

| Package               | Path                 | Description                                                                                          |
| --------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `@soteria/core`       | `packages/core`      | Dependency-free shared business logic: types, constants/strings, utils, and canonical ISO 45001 clause data. Defines its own structural `Timestamp` type. |
| `@soteria/ui`         | `packages/ui`        | Shared component library, design tokens (DESIGN_DOC §14), and the custom icon set.                  |
| `@soteria/firebase`   | `packages/firebase`  | Firebase initialization plus auth and Firestore helpers shared across apps.                         |
| `@soteria/mobile`     | `apps/mobile`        | React Native (Expo) field-audit application.                                                        |
| `@soteria/web`        | `apps/web`           | Next.js web dashboard and reporting application.                                                    |
| `soteria-functions`   | `functions`          | Firebase Functions v2: AI Co-Pilot endpoints, report generation, notifications.                    |

### Architectural rules (see `docs/multi-agent-guide.md`)

- **TypeScript strict mode everywhere.** No `any`, `as any`, or `@ts-ignore`
  without an inline comment explaining why.
- **All user-facing strings** live in `packages/core/src/constants/strings.ts`.
- **All ISO 45001 clause data** lives in `packages/core/src/iso45001/` — never
  hardcode clause numbers, titles, or requirements anywhere else.
- **AI / secret access** happens only in Firebase Functions via `defineSecret()`.
- **Tests for every function** (Jest); `@soteria/core` targets 90%+ coverage.

---

## Documentation

- [`docs/DESIGN_DOC.md`](docs/DESIGN_DOC.md) — comprehensive product design document.
- [`docs/multi-agent-guide.md`](docs/multi-agent-guide.md) — multi-agent contributor guide and non-negotiable rules.

---

## Phase 1 MVP — implementation status

Mirrors DESIGN_DOC §17 (Phase 1 — Core Audit Workflow):

- [ ] Authentication + multi-tenant setup
- [ ] Client / organization management
- [ ] Audit creation and planning
- [ ] Clause-by-clause assessment (all 10 clauses, all sub-clauses)
- [ ] Finding creation (MNC, NC, OFI, SP)
- [ ] Photo evidence capture and upload
- [ ] Opening and closing meeting recording
- [ ] Basic audit report generation (PDF)
- [ ] Offline mode (WatermelonDB sync)
- [ ] AI Co-Pilot (NCR drafting, clause questions)

---

*Soteria Assurance v1.0.0 — ISO 45001:2018 compliant design. © Trainovate Technologies.*
