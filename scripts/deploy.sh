#!/usr/bin/env bash
# =============================================================================
# Soteria Assurance — deploy script
# =============================================================================
# Builds the web app and deploys Firebase Hosting + Firestore/Storage rules +
# indexes + Functions, in a safe order. Intended for local/CI use once the web
# app (apps/web) and functions are in place.
#
# Project number 830573978482 (the textual project id is resolved from
# .firebaserc / --project / the active CLI project).
#
# Credentials: in CI, export FIREBASE_TOKEN (from `firebase login:ci`). Locally,
# `firebase login` is sufficient. SECRETS (ANTHROPIC_API_KEY, SENDGRID_API_KEY)
# are NOT handled here — set them once via:
#   firebase functions:secrets:set ANTHROPIC_API_KEY
#   firebase functions:secrets:set SENDGRID_API_KEY
#
# Usage:
#   scripts/deploy.sh [--project <projectId>] [--only hosting|functions|rules|all]
# =============================================================================

set -euo pipefail

# --- Resolve repo root (this script lives in <root>/scripts) -----------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"
cd "${ROOT_DIR}"

PROJECT_ID=""
ONLY_TARGET="all"

# --- Parse args --------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project|-p)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --only)
      ONLY_TARGET="${2:-all}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: scripts/deploy.sh [--project <projectId>] [--only hosting|functions|rules|all]"
      exit 0
      ;;
    *)
      echo "[soteria-deploy] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# --- Build the firebase CLI flag set -----------------------------------------
FIREBASE_FLAGS=()
if [[ -n "${PROJECT_ID}" ]]; then
  FIREBASE_FLAGS+=(--project "${PROJECT_ID}")
fi
if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
  FIREBASE_FLAGS+=(--token "${FIREBASE_TOKEN}")
fi

# --- Preconditions -----------------------------------------------------------
if ! command -v firebase >/dev/null 2>&1; then
  echo "[soteria-deploy] ERROR: firebase CLI not found. Install: npm i -g firebase-tools" >&2
  exit 1
fi

echo "[soteria-deploy] Repo root: ${ROOT_DIR}"
echo "[soteria-deploy] Target: ${ONLY_TARGET}"

# --- Build the web app (Next.js static export -> apps/web/out) ---------------
build_web() {
  echo "[soteria-deploy] Building web app (@soteria/web) ..."
  # pnpm + Turborepo build, filtered to the web app. The web app must be
  # configured for static export (output: 'export') so it emits apps/web/out.
  pnpm build:web
  if [[ ! -d "apps/web/out" ]]; then
    echo "[soteria-deploy] ERROR: apps/web/out not found after build." >&2
    echo "[soteria-deploy] Ensure apps/web is configured for static export (next.config: output: 'export')." >&2
    exit 1
  fi
}

# --- Deploy steps ------------------------------------------------------------
deploy_rules() {
  echo "[soteria-deploy] Deploying Firestore rules + indexes and Storage rules ..."
  firebase deploy "${FIREBASE_FLAGS[@]}" \
    --only firestore:rules,firestore:indexes,storage
}

deploy_functions() {
  echo "[soteria-deploy] Deploying Cloud Functions ..."
  # The firebase.json predeploy hook runs `npm --prefix functions run build`.
  firebase deploy "${FIREBASE_FLAGS[@]}" --only functions
}

deploy_hosting() {
  build_web
  echo "[soteria-deploy] Deploying Hosting (target: web) ..."
  firebase deploy "${FIREBASE_FLAGS[@]}" --only hosting:web
}

case "${ONLY_TARGET}" in
  hosting)
    deploy_hosting
    ;;
  functions)
    deploy_functions
    ;;
  rules)
    deploy_rules
    ;;
  all)
    deploy_rules
    deploy_functions
    deploy_hosting
    ;;
  *)
    echo "[soteria-deploy] ERROR: unknown --only target '${ONLY_TARGET}'." >&2
    echo "[soteria-deploy] Valid: hosting | functions | rules | all" >&2
    exit 1
    ;;
esac

echo "[soteria-deploy] Done."
