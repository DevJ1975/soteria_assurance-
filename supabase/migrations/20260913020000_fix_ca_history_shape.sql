-- Reconciles corrective_actions.history with CAHistoryEntry.
--
-- @soteria/core's CAHistoryEntry has always been {timestamp, action,
-- performedBy, notes?}. The escalation and effectiveness-review functions
-- appended {at, event, by, detail} instead — written without cross-checking
-- the domain type, since nothing read `history` yet at the time. Nothing
-- reads it today either (grepped: zero UI consumers), which is exactly why
-- this was caught in review rather than in the field, and exactly why it can
-- be fixed by changing the write side rather than living with a translation
-- layer on the read side forever.
--
-- 'performedBy' is not optional on the type, so escalate_overdue_corrective_
-- actions() — which runs on a schedule, with no calling user — writes the
-- literal string 'system' rather than a null or a fabricated uuid.
create or replace function public.escalate_overdue_corrective_actions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  escalated integer := 0;
begin
  with due as (
    select id, finding_id
    from public.corrective_actions
    where target_date < current_date
      and public.ca_is_open(status)
      and escalated_at is null
  ),
  stamped as (
    update public.corrective_actions ca
    set escalated_at = now(),
        history = coalesce(ca.history, '[]'::jsonb) || jsonb_build_object(
          'timestamp', now(),
          'action', 'escalated',
          'performedBy', 'system',
          'notes', format('Target date %s passed with status %s.', ca.target_date, ca.status)
        )
    from due
    where ca.id = due.id
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
begin
  select * into ca from public.corrective_actions where id = p_corrective_action_id;
  if ca.id is null then
    raise exception 'That corrective action does not exist.' using errcode = 'no_data_found';
  end if;

  if ca.tenant_id <> public.current_tenant_id() and not public.is_super_admin() then
    raise exception 'That corrective action belongs to another organization.'
      using errcode = 'insufficient_privilege';
  end if;

  if ca.status not in ('submitted', 'accepted', 'rejected') then
    raise exception 'A corrective action must be submitted before it can be reviewed (status is %).', ca.status
      using errcode = 'invalid_parameter_value';
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
  returning * into ca;

  update public.findings
  set status = case when p_effective then 'closed'::public.finding_status else 'ca_review'::public.finding_status end,
      closed_at = case when p_effective then now() else null end,
      actual_closure_date = case when p_effective then current_date else null end
  where id = ca.finding_id;

  return ca;
end;
$$;

grant execute on function public.record_effectiveness_review(uuid, boolean, text, text) to authenticated;
