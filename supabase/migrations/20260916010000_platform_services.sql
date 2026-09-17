-- Turns on the Supabase platform services this product has a real use for, and
-- wires each one up rather than merely installing it.
--
-- Each section says what it is for here. Anything Supabase offers that this
-- product has no use for is listed at the bottom with the reason, so "not
-- enabled" is a decision on the record rather than an oversight.

-- ---------------------------------------------------------------------------
-- 1. pg_graphql — the GraphQL endpoint the API already advertises
-- ---------------------------------------------------------------------------
-- `[api] schemas` in supabase/config.toml has listed "graphql_public" since the
-- project was created, and the `graphql` / `graphql_public` schemas exist from
-- the Supabase bootstrap — but the extension was never installed, so
-- POST /graphql/v1 has always been a 404 against an endpoint the config claims
-- to serve. Installing it is the smaller change; the alternative is removing a
-- capability from the API surface for no reason.
--
-- Useful here specifically because the audit model is deeply nested — an audit
-- has findings which have corrective actions which have history — and fetching
-- that over REST is the four round trips `supabase-data.ts` currently makes.
-- Only the extension is created here. The `graphql` and `graphql_public`
-- schemas, the `graphql_public.graphql` wrapper PostgREST calls, and the grants
-- on both already exist — Supabase's own bootstrap owns them as `supabase_admin`
-- and a migration running as `postgres` cannot (and should not) redefine them.
-- Attempting to left "permission denied for schema graphql_public".
--
-- Note the platform's grants include `anon`, unlike this schema's own tables.
-- That is harmless and not worth fighting: pg_graphql resolves as the calling
-- role, and 20260914000000 deliberately left `anon` with no table privileges at
-- all, so an anonymous GraphQL query resolves to nothing.
create extension if not exists pg_graphql;

-- Inflection on: pg_graphql otherwise names fields exactly as the columns are
-- named, so a query asks for `audit_number` while every TypeScript type in
-- @soteria/core calls it `auditNumber`. With this, the GraphQL schema matches
-- the domain types the clients already use and the mappers in
-- apps/web/lib/supabase-data.ts translate by hand for REST.
comment on schema public is '@graphql({"inflect_names": true})';

-- ---------------------------------------------------------------------------
-- 2. pg_net — outbound HTTP from Postgres, for database webhooks
-- ---------------------------------------------------------------------------
-- Lets a trigger call an Edge Function asynchronously. The immediate use is the
-- one thing this product does on a timer that would be better on an event:
-- `corrective-action-reminders` runs on a schedule and scans, when what actually
-- matters is the moment a finding is raised or an action is submitted.
--
-- Async by design: pg_net queues the request and returns immediately, so a slow
-- or unreachable endpoint cannot hold open the transaction that raised a
-- finding. That property is the whole reason to use it rather than `http`.
create extension if not exists pg_net with schema extensions;

-- Only server-side code should be able to make the database emit HTTP requests.
-- An API role with EXECUTE here could use the database as an SSRF relay.
revoke all on schema net from anon, authenticated;
revoke all on all functions in schema net from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. pgmq — durable queues
-- ---------------------------------------------------------------------------
-- Report generation and AI calls are slow, fallible and already the two places
-- this app does real work behind a request. A queue gives them retries and
-- visibility timeouts instead of a failed fetch and a lost job.
--
-- Queues are created here so they exist in every environment rather than being
-- conjured at runtime by whichever process happens to start first.
create extension if not exists pgmq;

select pgmq.create('report_generation')
where not exists (select 1 from pgmq.list_queues() where queue_name = 'report_generation');

select pgmq.create('ai_analysis')
where not exists (select 1 from pgmq.list_queues() where queue_name = 'ai_analysis');

select pgmq.create('notifications')
where not exists (select 1 from pgmq.list_queues() where queue_name = 'notifications');

-- Consumers are Edge Functions using the service role. A tenant member has no
-- reason to read or write a queue directly, and a queue is not tenant-scoped,
-- so exposing it to `authenticated` would cross the isolation boundary every
-- other table in this schema maintains.
revoke all on schema pgmq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. pgvector — semantic search over the clause corpus
-- ---------------------------------------------------------------------------
-- Installed here; the table and search function that use it are the next
-- migration, which is where the reasoning for them lives.
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- 5. index_advisor + hypopg — query performance advice
-- ---------------------------------------------------------------------------
-- The counterpart to the security advisors this project already consults.
-- hypopg creates hypothetical indexes so index_advisor can cost a plan against
-- one without building it — which matters on `audit_logs`, a table that only
-- grows and that every tenant reads.
create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;

-- ---------------------------------------------------------------------------
-- 6. Realtime — live audit collaboration
-- ---------------------------------------------------------------------------
-- An audit is worked by a team at once: a lead auditor and two auditors across
-- a site, each raising findings against the same audit. Today each one sees the
-- others' work only when React Query happens to refetch.
--
-- Postgres Changes enforces RLS per subscriber, so a client is only sent rows it
-- could have selected anyway — the tenant isolation already proven in
-- tenant-isolation.test.ts carries over to the socket unchanged.
--
-- `clients` and `tenants` are deliberately absent: they are administrative
-- records that change rarely and benefit nothing from a live feed.
do $$
declare
  t text;
begin
  foreach t in array array[
    'audits', 'findings', 'clause_assessments', 'corrective_actions', 'evidence'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;

    -- REPLICA IDENTITY FULL puts the pre-image of an updated or deleted row in
    -- the WAL. Realtime needs it to evaluate RLS against the OLD row; without
    -- it, an UPDATE that moves a row out of a subscriber's visibility cannot be
    -- filtered correctly. It costs write amplification on UPDATE, which is a
    -- fair trade on tables whose write volume is an auditor typing.
    execute format('alter table public.%I replica identity full', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Custom access token hook — tenant and role in the JWT
-- ---------------------------------------------------------------------------
-- Every sign-in currently costs two sequential round trips before the app knows
-- who the user is: `profiles` for tenant and role, then `tenants` for the name
-- and type (apps/web/lib/auth-context.tsx). Until both land the UI cannot tell
-- "still loading" from "no organization", which is why a transient failure
-- there shows a legitimate auditor the access-pending screen.
--
-- This puts the same facts in the token GoTrue already issues.
--
-- IMPORTANT, AND THE REASON RLS IS NOT CHANGED TO MATCH: a JWT is a snapshot,
-- valid for up to `jwt_expiry` (3600s). Deactivate a user or change their role
-- and their existing token still asserts the old values until it expires.
-- `current_tenant_id()` and `current_profile_role()` therefore keep reading
-- `profiles`, which is authoritative and immediate. These claims are a
-- client-side convenience for rendering; they are not an authorization source,
-- and nothing in RLS reads them.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_tenant_id uuid;
  v_role public.user_role;
  v_active boolean;
  v_tenant_name text;
  v_tenant_type text;
  claims jsonb;
begin
  select p.tenant_id, p.role, p.is_active, t.name, t.type::text
    into v_tenant_id, v_role, v_active, v_tenant_name, v_tenant_type
  from public.profiles p
  left join public.tenants t on t.id = p.tenant_id
  where p.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  if claims -> 'app_metadata' is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- A user with no profile, or a deactivated one, gets no claims rather than
  -- null ones. The app's "organization access pending" state is the absence of
  -- a tenant, so absence is the correct signal.
  if v_tenant_id is not null and v_active then
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(v_tenant_id::text));
    claims := jsonb_set(claims, '{app_metadata,tenant_role}', to_jsonb(v_role::text));
    claims := jsonb_set(claims, '{app_metadata,tenant_name}', to_jsonb(coalesce(v_tenant_name, '')));
    claims := jsonb_set(claims, '{app_metadata,tenant_type}', to_jsonb(coalesce(v_tenant_type, '')));
  end if;

  return jsonb_set(event, '{claims}', claims);
exception
  -- A hook that raises makes GoTrue refuse to mint the token, which locks every
  -- user out of the product. No convenience claim is worth that: on any error
  -- the event passes through untouched and the app falls back to the profile
  -- lookup it already does.
  when others then
    return event;
end;
$$;

-- The hook runs as supabase_auth_admin, which is outside this schema and is
-- subject to RLS on profiles like anyone else.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles, public.tenants to supabase_auth_admin;

drop policy if exists auth_admin_can_read_profiles on public.profiles;
create policy auth_admin_can_read_profiles on public.profiles
  for select to supabase_auth_admin using (true);

drop policy if exists auth_admin_can_read_tenants on public.tenants;
create policy auth_admin_can_read_tenants on public.tenants
  for select to supabase_auth_admin using (true);

-- Nothing else may call it. It is not a general-purpose profile reader.
revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Deliberately NOT enabled, and why
-- ---------------------------------------------------------------------------
--   wrappers (FDW)      No external data source to federate. Each wrapper is a
--                       credentialed outbound connection; adding them
--                       speculatively widens the blast radius for nothing.
--   pgsodium            Superseded by Supabase Vault for secret storage, which
--                       is already installed and is the supported path.
--   pgaudit             The append-only public.audit_logs trigger already
--                       records actor, tenant, before and after for every
--                       domain table. pgaudit logs to the server log, where
--                       this product's users cannot read it and it is not part
--                       of the audit record.
--   pgroonga / pg_tle   No full-text requirement Postgres FTS cannot serve, and
--                       no need to ship extensions from SQL.
--   http                pg_net covers the same ground asynchronously; the
--                       synchronous version would hold a transaction open on a
--                       remote call.
--   anonymous sign-ins  Access here is invitation-gated by design.
--   web3 / third-party  No Solana, Firebase, Auth0, Clerk or Cognito identities
--   auth bridges        to federate. Firebase in particular is the system this
--                       product migrated off; bridging back would undo that.
