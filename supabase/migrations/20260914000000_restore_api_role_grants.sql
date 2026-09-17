-- Grants the API roles the table privileges PostgREST needs, explicitly.
--
-- THE BUG THIS CLOSES
-- On a database provisioned from these migrations against PostgreSQL 17 —
-- which supabase/config.toml pins (`major_version = 17`) — no table in
-- `public` grants SELECT/INSERT/UPDATE/DELETE to `authenticated` or
-- `service_role`. Every PostgREST call fails with
--   42501: permission denied for table <name>
-- so the web app, the mobile app and every Edge Function that uses the REST
-- API are dead against a freshly provisioned database. RLS never even gets
-- consulted: the table-level GRANT is checked first, and it is not there.
--
-- Verified on CLI 2.115 / PG 17.6: after applying the preceding 20 migrations,
-- `authenticated` held only REFERENCES and TRIGGER on all 14 tables, and a
-- table created afterwards inherited the same. A PostgreSQL 15 project on the
-- same host was unaffected, which is why this survived review — it depends on
-- the server major version, not on anything visible in the SQL.
--
-- ROOT CAUSE
-- 20260912150000_revoke_truncate.sql calls `alter default privileges ... revoke
-- truncate on tables from anon, authenticated` in schema `public`. Where a
-- default-ACL entry already exists that removes only TRUNCATE, which is the
-- intended effect (reproduced in an isolated schema on this same server). On
-- PG17 no such entry pre-exists for role `postgres` in `public`, so the REVOKE
-- materializes one from the built-in default — under which the API roles hold
-- nothing — and the platform's implicit grants stop applying.
--
-- THE FIX, AND WHY IT IS SHAPED THIS WAY
-- Stop depending on an implicit platform default that changes between server
-- versions, and state the privileges this product actually wants. For a
-- product whose deliverable is a defensible audit record, the grant set should
-- be readable in the migration history rather than inherited invisibly.
--
-- `anon` is deliberately given nothing. Stock Supabase grants it full DML and
-- relies on RLS to hold the line, but this application has no anonymous data
-- surface at all: sign-in and registration go through GoTrue, not PostgREST,
-- and no table carries a policy for `anon`. Granting it DML would buy nothing
-- and would widen the blast radius of any future policy mistake.

-- 1. Existing tables.
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

-- 2. Tables created by later migrations, so this does not silently lapse the
--    next time someone adds a table (the exact failure mode that produced the
--    bug above).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- 3. Sequences, for completeness. Every key in this schema is a uuid today, so
--    this grants nothing now; it stops a future `bigserial` column from
--    reintroducing the same class of failure.
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- 4. Re-apply every deliberate restriction, because the blanket grants above
--    would otherwise hand back privileges earlier migrations removed on
--    purpose. Each mirrors 20260912150000_revoke_truncate.sql; see that file
--    for the reasoning (TRUNCATE is not subject to RLS and does not fire row
--    triggers, so it bypasses the append-only audit log entirely).
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

--    audit_logs and ai_logs are written only by SECURITY DEFINER code and by
--    the Edge Functions' service-role client. The caller's role needs SELECT
--    and nothing more.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.ai_logs from anon, authenticated;
