#!/usr/bin/env bash
# =============================================================================
# One command to get a reviewable Soteria Assurance running locally on Docker.
# =============================================================================
#   ./scripts/docker-review.sh          start everything (idempotent)
#   ./scripts/docker-review.sh --reset  wipe the database and reseed first
#   ./scripts/docker-review.sh --down   stop the web app (leaves Supabase up)
#   ./scripts/docker-review.sh --stop   stop everything, including Supabase
#
# The Supabase side (Postgres, Auth, PostgREST, Storage, Edge Functions,
# Studio) is Docker too — it is orchestrated by the Supabase CLI, which also
# applies supabase/migrations. The web app is built and run by docker compose.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_PORT=54521

info() { printf '\033[1;36m›\033[0m %s\n' "$1"; }
ok()   { printf '\033[1;32m✔\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m✖\033[0m %s\n' "$1" >&2; exit 1; }

command -v supabase >/dev/null || die 'Supabase CLI not found: https://supabase.com/docs/guides/cli'
docker info >/dev/null 2>&1   || die 'Docker is not running.'

# This machine has more than one container engine (Docker Desktop and
# OrbStack). The Supabase CLI and docker compose must talk to the SAME one, or
# compose will fail to find the network the CLI created. Whichever context is
# active is fine — just report it, so a mismatch is visible rather than
# mysterious.
info "docker context: $(docker context show 2>/dev/null || echo default)"

case "${1:-}" in
  --down)
    docker compose down --remove-orphans
    ok 'Web app stopped. Supabase is still running (`supabase stop` to stop it).'
    exit 0
    ;;
  --stop)
    docker compose down --remove-orphans || true
    supabase stop
    ok 'Everything stopped.'
    exit 0
    ;;
esac

# --- 1. Supabase -------------------------------------------------------------
if supabase status >/dev/null 2>&1; then
  info 'Supabase already running.'
else
  info 'Starting Supabase (first run pulls images — a few minutes)...'
  supabase start >/dev/null
fi
ok "Supabase up on http://127.0.0.1:${PROJECT_PORT}"

if [ "${1:-}" = '--reset' ]; then
  info 'Resetting database and reapplying every migration...'
  supabase db reset >/dev/null
  ok 'Database reset.'
fi

# --- 2. Keys -----------------------------------------------------------------
# Read from the CLI rather than hardcoding: they are stable for the local
# stack, but pinning them in a committed file invites copying one into a real
# deployment.
STATUS_JSON="$(supabase status -o json)"
read_key() { printf '%s' "$STATUS_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }

export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:${PROJECT_PORT}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(read_key ANON_KEY)"
SERVICE_ROLE_KEY="$(read_key SERVICE_ROLE_KEY)"

# --- 3. Demo data ------------------------------------------------------------
# The product has no UI that creates a client organization, and the New Audit
# wizard requires one — so without this seed the app is an empty shell with a
# permanently empty client dropdown. See docs/DOCKER_REVIEW.md.
info 'Seeding demo data...'
SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node scripts/seed-local-demo.mjs >/dev/null
ok 'Demo tenant seeded.'

# --- 4. Web app --------------------------------------------------------------
info 'Building and starting the web app...'
docker compose up -d --build

# Wait for it to actually serve, rather than claiming success on `up`.
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/login/" 2>/dev/null; then
    READY=1; break
  fi
  sleep 2
done

if [ "${READY:-0}" != '1' ]; then
  die 'Web app did not come up. Logs: docker compose logs web'
fi

cat <<BANNER

$(ok 'Ready for review.')

  Web app          http://127.0.0.1:3000
  Supabase Studio  http://127.0.0.1:54523     (browse/edit any table)
  Inbucket (mail)  http://127.0.0.1:54524
  Postgres         postgresql://postgres:postgres@127.0.0.1:54522/postgres

  Sign in with any of these — password: SoteriaDemo!2026

    lead@soteria.demo      Lead auditor    ← start here
    admin@soteria.demo     Tenant admin
    auditor@soteria.demo   Auditor
    auditee@soteria.demo   Auditee         (should be read-only)
    viewer@soteria.demo    Viewer          (should be read-only)

  Logs   docker compose logs -f web
  Stop   ./scripts/docker-review.sh --stop

  Read docs/DOCKER_REVIEW.md before judging what you see — several screens are
  read-only because the create paths do not exist yet, not because of setup.

BANNER
