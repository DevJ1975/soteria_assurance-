-- Takes TRUNCATE away from the API roles, and stops the write privileges on
-- the two log tables that nothing should write directly.
--
-- TRUNCATE is the one statement row-level security cannot touch: it is not
-- subject to RLS policies and does not fire FOR EACH ROW triggers. So the
-- append-only guarantee on audit_logs — a BEFORE UPDATE OR DELETE trigger that
-- raises — is bypassed entirely by it, and the tenant scoping on every other
-- table is too. Verified before this migration: as plain `authenticated`,
-- `delete from public.audit_logs` correctly removed nothing (RLS hid the rows)
-- while `truncate public.audit_logs` removed all 375, across every tenant.
--
-- It was not remotely reachable: PostgREST has no TRUNCATE verb and answers
-- 405. This is defence in depth, not an open door — but the privilege buys
-- nothing, applies to every table, and for a product whose audit trail is the
-- deliverable the gap is not worth leaving where only the API surface is
-- closing it.
revoke truncate on all tables in schema public from anon, authenticated;

-- Supabase's default privileges grant `arwdDxtm` — D is TRUNCATE — to anon and
-- authenticated for every table created afterwards, so a revoke alone would
-- last exactly until the next migration added a table.
alter default privileges in schema public revoke truncate on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

-- audit_logs and ai_logs are written only by SECURITY DEFINER code — the
-- log_core_table_change trigger and the AI Edge Functions' service-role client
-- — both of which run as the definer rather than as the caller. So the API
-- roles need no write privilege at all here, and SELECT plus the existing RLS
-- is the whole of what they should have.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.ai_logs from anon, authenticated;
