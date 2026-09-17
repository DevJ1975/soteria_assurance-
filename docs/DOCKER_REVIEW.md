# Reviewing Soteria Assurance locally on Docker

A one-command local stack so you can click through the product as a real
auditor would, with realistic data already in it.

> **Read "What you are looking at" before judging the app.** Several screens
> are read-only or empty because the feature is not built yet, not because the
> environment is misconfigured. This document tells you which is which.

---

## Run it

```bash
./scripts/docker-review.sh
```

First run pulls the Supabase images and builds the web image — a few minutes.
Subsequent runs take seconds.

| Flag | Effect |
| --- | --- |
| *(none)* | Start everything. Safe to re-run; the seed is idempotent. |
| `--reset` | Drop the database, reapply every migration, reseed. Use after changing a migration. |
| `--down` | Stop the web app, leave Supabase running. |
| `--stop` | Stop everything. |

### What you get

| | |
| --- | --- |
| Web app | <http://127.0.0.1:3000> |
| Supabase Studio | <http://127.0.0.1:54523> — browse or edit any table directly |
| Inbucket (captured mail) | <http://127.0.0.1:54524> |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54522/postgres` |
| Supabase API | <http://127.0.0.1:54521> |

### Logins

Password for all of them: `SoteriaDemo!2026`

| Email | Role | Why you'd use it |
| --- | --- | --- |
| `lead@soteria.demo` | Lead auditor | **Start here.** Sees the whole audit. |
| `admin@soteria.demo` | Tenant admin | Settings and user management. |
| `auditor@soteria.demo` | Auditor | Team member on the seeded audit. |
| `auditee@soteria.demo` | Auditee | The audited party. *Should* be read-only — see below. |
| `viewer@soteria.demo` | Viewer | *Should* be read-only — see below. |

### The seeded audit

**AUD-2026-0041** — a surveillance audit of *Northgate Steel Fabrication Ltd*,
in progress, conducted by *Meridian Certification Services*. It carries a full
audit plan (7 timed activities, 6 documents, 3 interviewees, 4 inspection
areas), 12 clause assessments, and 5 findings — one of each grade:

| Finding | Grade | Clause |
| --- | --- | --- |
| MNC-2026-0001 | Major NC | 6.1.2.1 — psychosocial hazards never identified |
| NC-2026-0002 | Minor NC | 5.4 — worker reps appointed by management |
| NC-2026-0003 | Minor NC | 10.2 — effectiveness "reviewed" on the day of implementation |
| OFI-2026-0004 | Opportunity | 8.1.2 — RPE relied on where LEV was planned |
| SP-2026-0005 | Strong point | 9.2 — internal audit trend analysis |

NC-2026-0002 has a corrective action mid-workflow (submitted, awaiting the
effectiveness review), so the follow-up screens have something in them.

---

## What you are looking at

### Why there is a seed script at all

`scripts/seed-local-demo.mjs` writes the demo tenant with the service-role key,
bypassing the application. It exists because **the product has no UI that
creates a client organization** — and the New Audit wizard requires one, so its
client dropdown would be permanently empty and no audit could ever be created.
The seed is a review fixture. It does not fix anything.

### Screens that are read-only because the feature does not exist

Not setup problems. Do not spend time debugging these:

- **Clients** — list only. No create or edit anywhere in web or mobile.
- **Corrective actions** — list only. Nothing can create one or submit one.
- **Audit plan** — written once as an empty object; no editor exists. The
  mobile plan screen is read-only by design and would be blank without the seed.
- **Meetings** — fully specified in the type model, but there is no `meetings`
  table. Opening and closing meeting records are not persisted at all.
- **Evidence on web** — no UI. The data-layer helpers exist and are unused.
- **Audit lifecycle** — every audit stays `planned`; the seed sets
  `in_progress` directly. No screen issues a report or closes an audit.
- **Findings summary tiles** on the audit detail pages read a denormalized
  column nothing maintains, so they show all zeros. The report page and
  dashboard compute live and are correct.

### The AI co-pilot

Returns a clear 503 unless you supply a key:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > supabase/functions/.env
supabase functions serve
```

Auth, tenant checks and rate limiting all run before that point, so the
endpoints are still worth poking at without a key.

### Mobile

Not containerized — Expo needs a simulator or a physical device. Run it with
`pnpm --filter @soteria/mobile start`. Be aware the field app currently cannot
load data (nothing populates its local database) and nothing it captures can
sync, so there is little to review there yet.

---

## Reproducing the two most serious findings

Worth doing yourself rather than taking on trust.

### 1. Role is not enforced below the UI

Sign in as `auditee@soteria.demo` — the audited party. The UI correctly gives
them a read-only view. Now go around it:

```bash
ANON=$(supabase status -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["ANON_KEY"])')
TOKEN=$(curl -s -X POST "http://127.0.0.1:54521/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"auditee@soteria.demo","password":"SoteriaDemo!2026"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Rewrite the Major NC raised against them:
curl -s -X PATCH "http://127.0.0.1:54521/rest/v1/findings?id=eq.44444444-4444-4444-8444-444444444441" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
  -d '{"nonconformity_statement":"REWRITTEN BY THE AUDITED PARTY"}'
```

This succeeds. So does `DELETE` on a finding, and so does a `viewer` editing the
audit scope — all three were run against this stack and all three returned
success. Every RLS policy on the six business tables is tenant-scoped only: no
policy anywhere examines the caller's role, and the `ROLE_PERMISSIONS` matrix in
`packages/core/src/constants/rbac.ts` gates nothing but two screens that render
it as text.

Re-run `./scripts/docker-review.sh` afterwards to restore the demo data.

### 2. Tenant isolation, by contrast, holds

The same request against another tenant's rows returns nothing. That half of
the model is correct and well tested — it is specifically the *role* dimension
that is missing.

---

## Troubleshooting

**`ports are not available` / compose cannot find the network.**
This machine has two container engines (Docker Desktop and OrbStack). The
Supabase CLI and `docker compose` must talk to the same one, or compose will
fail to find the network the CLI created — and `docker ps` against the wrong one
makes every container look deleted. Check with `docker context show` and switch
with `docker context use orbstack`. The script prints the active context on
every run for exactly this reason.

**Port collisions with other local Supabase projects.**
Soteria uses the **545xx** block (API 54521, DB 54522, Studio 54523) rather
than the default 543xx, so it can run alongside other local Supabase projects.

**`permission denied for table …`**
Means `20260914000000_restore_api_role_grants.sql` has not been applied. Run
`./scripts/docker-review.sh --reset`.

**Web app shows "Supabase is not configured".**
`NEXT_PUBLIC_*` values are baked in at image build time. Rebuild:
`docker compose up -d --build`.

---

## How the pieces fit

```
  Browser  ──▶  http://127.0.0.1:3000   soteria_web_review  (docker compose)
                                              │
                                              │ server-side: SUPABASE_INTERNAL_URL
                                              │              http://kong:8000
                                              ▼
  Browser  ──▶  http://127.0.0.1:54521  ─▶  supabase_kong_soteria-local
                                              ├── auth (GoTrue)
                                              ├── rest (PostgREST)
                                              ├── storage
                                              ├── edge functions
                                              └── postgres  ◀── supabase/migrations
```

The web container needs **two** URLs for the same gateway because
`NEXT_PUBLIC_SUPABASE_URL` is inlined into the browser bundle and must be an
origin the *browser* can reach, while Next's middleware runs *inside* the
container and reaches Kong by service name. `SUPABASE_INTERNAL_URL` overrides
the URL for server-side calls only; it is unset outside Docker, so hosted and
`pnpm dev` behaviour is unchanged. See `apps/web/utils/supabase/server.ts`.
