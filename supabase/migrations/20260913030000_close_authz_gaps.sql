-- Closes four unauthenticated/under-authorized write and read paths found in
-- a live bug hunt against this database, plus one authorization gap in the
-- corrective-action review workflow.
--
-- Root cause behind three of these: public.current_tenant_id() returns NULL
-- (not an error) for a caller with no active profile row. A guard written as
-- `if x <> current_tenant_id() and not is_super_admin() then raise` silently
-- never fires for that caller, because `x <> NULL` is NULL, `NULL and true`
-- is NULL, and PL/pgSQL's IF treats a NULL condition as false. That caller is
-- real: the anon API key (shipped in every client bundle), or a signed-in
-- user with no profile yet (the product's own "access pending" screen is
-- exactly this state). Confirmed live: an unauthenticated POST to
-- record_effectiveness_review over PostgREST, using nothing but the anon key,
-- flipped a real corrective action from submitted to rejected and its linked
-- finding from closed back to ca_review.
--
-- The other half of the same root cause: every one of these functions also
-- still carried the default PUBLIC execute grant Postgres/Supabase applies at
-- creation (see 20260912170000_enforce_auditor_seats.sql's own comment on
-- this — it took two attempts there to learn that `revoke ... from public`
-- and `revoke ... from anon, authenticated` are both required, since either
-- alone leaves the function fully reachable through the other).

-- 1. record_effectiveness_review: require a real, resolvable tenant instead
--    of tolerating NULL, and stop treating an already-accepted/closed CA as
--    still reviewable — 'accepted' and 'closed' are the terminal states
--    public.ca_is_open() already excludes elsewhere; 'rejected' stays
--    reviewable since nothing in this app resubmits a rejected CA back to
--    'submitted' yet, and this is the only path that can ever move one
--    forward to 'accepted'. Closing this off also fixes a lost-update race:
--    the write's own WHERE clause now re-checks status, so a concurrent
--    second reviewer's write is rejected instead of silently overwriting the
--    first.
create or replace function public.record_effectiveness_review(
  p_corrective_action_id uuid,
  p_effective boolean,
  p_result text,
  p_notes text default null
)
returns public.corrective_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  ca public.corrective_actions;
  reviewer uuid := auth.uid();
  caller_tenant uuid := public.current_tenant_id();
  updated public.corrective_actions;
begin
  select * into ca from public.corrective_actions where id = p_corrective_action_id;
  if ca.id is null then
    raise exception 'That corrective action does not exist.' using errcode = 'no_data_found';
  end if;

  if caller_tenant is null and not public.is_super_admin() then
    raise exception 'You must belong to an organization to do that.'
      using errcode = 'insufficient_privilege';
  end if;

  if ca.tenant_id <> caller_tenant and not public.is_super_admin() then
    raise exception 'That corrective action belongs to another organization.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.corrective_actions
  set status = case when p_effective then 'accepted'::public.ca_status else 'rejected'::public.ca_status end,
      effectiveness_result = p_result,
      effectiveness_check_date = current_date,
      reviewed_date = current_date,
      reviewed_by_auditor_id = reviewer,
      review_notes = coalesce(p_notes, review_notes),
      closed_date = case when p_effective then current_date else null end,
      escalated_at = case when p_effective then escalated_at else null end,
      history = coalesce(history, '[]'::jsonb) || jsonb_build_object(
        'timestamp', now(),
        'action', case when p_effective then 'effectiveness_accepted' else 'effectiveness_rejected' end,
        'performedBy', reviewer::text,
        'notes', p_result
      )
  where id = p_corrective_action_id
    -- Re-checked here, not just in the SELECT above: a second reviewer (or
    -- the same one from a second tab) racing this statement now finds no row
    -- matching once the first has committed, instead of overwriting it.
    and status in ('submitted', 'rejected')
  returning * into updated;

  if updated.id is null then
    raise exception 'A corrective action must be submitted (or previously rejected) before it can be reviewed (status is %).', ca.status
      using errcode = 'invalid_parameter_value';
  end if;
  ca := updated;

  update public.findings
  set status = case when p_effective then 'closed'::public.finding_status else 'ca_review'::public.finding_status end,
      closed_at = case when p_effective then now() else null end,
      actual_closure_date = case when p_effective then current_date else null end
  where id = ca.finding_id;

  return ca;
end;
$$;

revoke execute on function public.record_effectiveness_review(uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.record_effectiveness_review(uuid, boolean, text, text) to authenticated;

-- 2. next_document_seq: same NULL-unsafe guard, same missing revoke.
create or replace function public.next_document_seq(
  p_tenant_id uuid,
  p_prefix text,
  p_year integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  if p_tenant_id is null or (p_tenant_id <> public.current_tenant_id() and not public.is_super_admin()) then
    raise exception 'You may only allocate document numbers for your own organization.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.document_sequences (tenant_id, prefix, year, next_seq)
  values (p_tenant_id, p_prefix, p_year, 2)
  on conflict (tenant_id, prefix, year)
  do update set next_seq = public.document_sequences.next_seq + 1
  returning next_seq - 1 into v_seq;

  return v_seq;
end;
$$;

revoke execute on function public.next_document_seq(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.next_document_seq(uuid, text, integer) to authenticated;

-- 3. ai_usage_last_hour never had a caller check at all, only ever meant to
--    be called by the service-role client inside the AI Edge Functions (see
--    supabase/functions/_shared/ai.ts's beginAICall). Nothing legitimate
--    calls it as an ordinary user, so the fix is to make sure nothing else
--    can either, rather than bolt on a tenant check nothing needs.
revoke execute on function public.ai_usage_last_hour(uuid)
  from public, anon, authenticated;

-- 4. escalate_overdue_corrective_actions: only meant to run via pg_cron or
--    the CRON_SECRET-gated corrective-action-reminders function, both of
--    which use the service role (or postgres, for pg_cron) — never a client
--    session. It also had a real double-escalation race: the "not yet
--    escalated" check lived in a CTE, and the UPDATE's join on that CTE's id
--    list never re-checked escalated_at at write time, so two overlapping
--    runs could both escalate the same corrective action. Flattening the
--    check into the UPDATE's own WHERE clause fixes both: only the intended
--    callers can reach it, and Postgres's own concurrent-update re-check now
--    protects the write the way it already does for record_effectiveness_review
--    above.
create or replace function public.escalate_overdue_corrective_actions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  escalated integer := 0;
begin
  with stamped as (
    update public.corrective_actions ca
    set escalated_at = now(),
        history = coalesce(ca.history, '[]'::jsonb) || jsonb_build_object(
          'timestamp', now(),
          'action', 'escalated',
          'performedBy', 'system',
          'notes', format('Target date %s passed with status %s.', ca.target_date, ca.status)
        )
    where ca.target_date < current_date
      and public.ca_is_open(ca.status)
      and ca.escalated_at is null
    returning ca.finding_id
  )
  update public.findings f
  set status = 'overdue'
  from stamped
  where f.id = stamped.finding_id
    and f.status not in ('closed', 'overdue');

  get diagnostics escalated = row_count;
  return escalated;
end;
$$;

revoke execute on function public.escalate_overdue_corrective_actions()
  from public, anon, authenticated;

-- 5. tenants had no legitimate ordinary-member write path at all (grepped
--    the web app: the only `.from('tenants')` call anywhere is a read-only
--    select in the superadmin console) — the policy existed but nothing used
--    it for anything real. It also had no WITH CHECK, so Postgres reused its
--    USING clause ("this is my own tenant") for both read and write, leaving
--    every column — including max_auditors and enabled_standards — writable
--    by any member, including a viewer. The exact bug shape already found
--    and fixed on profiles in 20260912080000_lock_down_profile_and_invitation_access.sql,
--    never applied here. Since nothing needs it, remove it rather than
--    reconstruct it with a narrower WITH CHECK: super_admin_can_update_tenants
--    already covers the one legitimate writer.
drop policy if exists tenant_members_can_update on public.tenants;
