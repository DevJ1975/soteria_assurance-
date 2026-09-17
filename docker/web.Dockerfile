# =============================================================================
# Soteria Assurance — web app (Next.js 15) review image
# =============================================================================
# Built for REVIEW, not production: it runs `next start` against a locally
# containerized Supabase so a reviewer can click through the real app.
#
# Node is pinned to the version in .nvmrc (22), not the host's.
# =============================================================================
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- deps --------------------------------------------------------------------
# Copy only the manifests first so a source-only change does not re-resolve
# the whole workspace.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY packages/core/package.json  packages/core/package.json
COPY packages/ui/package.json    packages/ui/package.json
COPY apps/web/package.json       apps/web/package.json
COPY apps/mobile/package.json    apps/mobile/package.json
COPY tests/package.json          tests/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- build -------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/ui/node_modules   ./packages/ui/node_modules
COPY --from=deps /app/apps/web/node_modules      ./apps/web/node_modules
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time, so the
# Supabase URL/key the browser will use must be present here, not just at run.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @soteria/core build \
 && pnpm --filter @soteria/ui   build \
 && pnpm --filter @soteria/web  build

# --- run ---------------------------------------------------------------------
FROM base AS run
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
WORKDIR /app/apps/web
# `next start` reads these from the environment. Passing them as argv through
# `pnpm start --` does not work: pnpm forwards the `--` itself, and Next reads
# the first positional as a project directory.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
