# Soteria Assurance

> ISO 45001:2018 AI-assisted audit management platform — built by Trainovate Technologies.

Soteria Assurance is a mobile-first, offline-capable platform for occupational
health & safety (OH&S) auditors. It guides a lead auditor clause-by-clause
through ISO 45001:2018, captures photo/audio evidence in the field, records
findings (MNC / NC / OFI / SP), and uses an AI Co-Pilot (Anthropic Claude API)
to draft nonconformity reports and suggest interview questions. Multi-tenant by
design, it serves certification bodies, consultancies, and in-house audit teams.

---

## Monorepo structure

```
soteria-assurance/
├── package.json                ← Root workspace (pnpm + Turborepo)
├── pnpm-workspace.yaml
├── turbo.json                  ← Turborepo task graph
├── tsconfig.base.json          ← Shared strict TS compiler options + path aliases
├── eslint.config.mjs           ← Flat ESLint config (no-explicit-any: error)
│
├── packages/
│   ├── core/                   ← @soteria/core — dependency-free business logic
│   │   └── src/
│   │       ├── types/          ← All TypeScript interfaces
│   │       ├── constants/      ← strings, finding types, RBAC matrix, AI prompts
│   │       ├── utils/          ← scoring, deadlines, validators, numbering
│   │       └── standards/      ← Canonical ISO 45001 clause dataset + registry
│   └── ui/                     ← @soteria/ui — shared tokens + component library
│
├── apps/
│   ├── mobile/                 ← @soteria/mobile — React Native (Expo SDK 52)
│   └── web/                    ← @soteria/web — Next.js 15 (App Router)
│
├── supabase/
│   ├── migrations/             ← Postgres schema, RLS policies, triggers
│   ├── functions/              ← Edge Functions (Deno): AI, reports, admin
│   └── config.toml             ← Local stack config (ports 545xx)
│
├── tests/                      ← @soteria/e2e — integration tests against a real stack
├── docker/ + docker-compose.yml ← Local review stack (see docs/DOCKER_REVIEW.md)
└── docs/
    ├── DOCKER_REVIEW.md        ← Run the whole thing locally, with demo data
    ├── DESIGN_DOC.md           ← Product design document
    └── DEPLOYMENT.md           ← Deployment notes
```

---

## Tech stack

| Layer              | Technology                                             |
| ------------------ | ------------------------------------------------------ |
| Language           | TypeScript 5.x (strict mode everywhere)                |
| Mobile             | React Native 0.76+ with Expo SDK 52, Expo Router       |
| Web                | Next.js 15 (App Router)                                |
| Mobile UI          | React Native Paper + custom components                 |
| Web UI             | shadcn/ui + Tailwind CSS 3                             |
| State              | Zustand + TanStack Query v5                            |
| Forms / validation | React Hook Form + Zod                                  |
| Offline sync       | WatermelonDB (SQLite, offline-first)                   |
| Database           | **Supabase Postgres** (RLS-enforced multi-tenancy)     |
| Auth               | **Supabase Auth (GoTrue)**                             |
| Storage            | **Supabase Storage** (private, tenant-prefixed buckets)|
| Serverless         | **Supabase Edge Functions (Deno)**                     |
| AI                 | Anthropic Claude API                                   |
| PDF generation     | **pdf-lib**, inside an Edge Function                   |
| Monorepo / tooling | Turborepo, pnpm, ESLint, Prettier                      |
| Testing            | Jest + Testing Library; integration suite in `tests/`  |
| CI/CD              | GitHub Actions                                         |

> **Note for anyone reading older docs:** this project previously targeted
> Firebase/Firestore/Puppeteer. It does not any more. `docs/DESIGN_DOC.md` §§6–8
> and `docs/DEPLOYMENT.md` still describe that stack and are stale; the schema
> in `supabase/migrations/` is the source of truth. The RBAC matrix is
> authoritative in `packages/core/src/constants/rbac.ts`, and as of
> `20260914010000_enforce_roles_in_rls.sql` it is enforced by RLS.

---

## Prerequisites

- Node.js 22 (`.nvmrc`)
- pnpm 9+
- Docker (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## Getting started

The fastest path to a running system with realistic data:

```bash
./scripts/docker-review.sh
```

That starts Supabase, applies every migration, seeds a demo tenant, and builds
and runs the web app at <http://127.0.0.1:3000>. See
[docs/DOCKER_REVIEW.md](docs/DOCKER_REVIEW.md) for logins, what to look at, and
what is deliberately not built yet.

To work on the code directly instead:

```bash
pnpm install
supabase start                    # applies supabase/migrations
pnpm dev:web                      # or: pnpm dev:mobile
```

The web app needs `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status`>
```

Server-only secrets (`ANTHROPIC_API_KEY`, `SENDGRID_API_KEY`) go in
`supabase/functions/.env` locally, or `supabase secrets set` for a hosted
project. They never reach the browser; without `ANTHROPIC_API_KEY` the AI
endpoints return a clear 503 and every other check still runs.

### Common commands

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `pnpm build`           | Build all packages and apps                             |
| `pnpm test`            | Unit tests (`@soteria/core`, `@soteria/ui`)             |
| `pnpm test:e2e`        | Integration tests against a running local Supabase stack |
| `pnpm lint`            | Lint the whole monorepo                                 |
| `pnpm typecheck`       | Type-check every package                                |
| `pnpm format`          | Format with Prettier                                    |
| `pnpm dev:web`         | Next.js dev server                                      |
| `pnpm dev:mobile`      | Expo dev server                                         |
| `pnpm superadmin:local`| Create a superadmin against the local stack             |

> `pnpm test` does **not** run the integration suite — it needs a live
> database. CI runs it as a separate job that applies every migration to a
> clean Postgres first.

---

## Packages

| Package           | Path             | Description                                                                                   |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `@soteria/core`   | `packages/core`  | Dependency-free shared logic: types, constants, utils, and the canonical ISO 45001 clause data. |
| `@soteria/ui`     | `packages/ui`    | Shared component library and design tokens.                                                   |
| `@soteria/mobile` | `apps/mobile`    | React Native (Expo) field-audit application.                                                  |
| `@soteria/web`    | `apps/web`       | Next.js dashboard and reporting application.                                                  |
| `@soteria/e2e`    | `tests`          | Integration tests that exercise real RLS against a real database.                             |
| Edge Functions    | `supabase/functions` | AI Co-Pilot, report generation, invitations, admin actions, reminders.                    |

### Architectural rules

- **The clause dataset is the single source of truth.** Never hardcode clause
  numbers, titles or requirement text — read them through the standards
  registry helpers. `packages/core/src/__tests__/standards.test.ts` pins the
  exact 56-clause set of ISO 45001:2018 by set equality.
- **Requirement text is paraphrased, never copied** from the published
  standard. It ends up in client-delivered NCRs.
- **Authorization lives in the database.** RLS policies carry both a tenant and
  a role predicate; Edge Functions re-derive the caller's tenant from their
  profile and never trust a body-supplied tenant id.
- **Audit records are append-mostly.** `audit_logs` is immutable, evidence and
  issued reports are write-once in storage, findings freeze once a report is
  issued, and deletion is soft.

---

## Documentation

| Document                                     | What it covers                                    |
| -------------------------------------------- | ------------------------------------------------- |
| [docs/DOCKER_REVIEW.md](docs/DOCKER_REVIEW.md) | Running the full stack locally, with demo data  |
| [docs/DESIGN_DOC.md](docs/DESIGN_DOC.md)     | Product design (§§6–8 describe the old stack)     |
| [docs/multi-agent-guide.md](docs/multi-agent-guide.md) | Contributor guide                       |
| `supabase/migrations/`                       | The schema, and the reasoning behind each change  |

Each migration's header explains the bug or requirement it addresses. For the
security-relevant ones that is the most accurate documentation in the repo.
