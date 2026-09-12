-- Corrective-action reminders, overdue escalation and effectiveness review.

-- Reminder bookkeeping. Overdue itself is NOT stored: it is
-- `target_date < today AND status is not terminal`, and a stored copy would be
-- wrong every day between the date passing and the job that updates it running.
-- What must be stored is what the platform has already told people, so a
-- reminder is not sent twice a day and escalation fires once.
alter table public.corrective_actions
  add column if not exists last_reminder_sent_at timestamptz,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists escalated_at timestamptz;

-- Statuses a corrective action can still move from. Accepted and closed are
-- done; rejected is awaiting the responsible person, so it still chases.
create or replace function public.ca_is_open(status public.ca_status)
returns boolean
language sql
immutable
as $$
  select status not in ('accepted', 'closed');
$$;

/**
 * Corrective actions that need chasing, with why.
 *
 * One view rather than three queries because "due soon", "due today" and
 * "overdue" are the same row set cut by the same date arithmetic; splitting
 * them invites the three definitions to drift.
 */
create or replace view public.corrective_actions_due
with (security_invoker = true) as
select
  ca.id,
  ca.tenant_id,
  ca.audit_id,
  ca.finding_id,
  ca.ca_number,
  ca.title,
  ca.status,
  ca.target_date,
  ca.responsible_person_name,
  ca.responsible_person_email,
  ca.last_reminder_sent_at,
  ca.reminder_count,
  ca.escalated_at,
  (ca.target_date - current_date) as days_until_due,
  case
    when ca.target_date < current_date then 'overdue'
    when ca.target_date = current_date then 'due_today'
    else 'due_soon'
  end as urgency
from public.corrective_actions ca
where public.ca_is_open(ca.status)
  and ca.target_date <= current_date + interval '7 days';

grant select on public.corrective_actions_due to authenticated;

/**
 * Escalates corrective actions whose target date has passed.
 *
 * Pure SQL and no email: escalation is a state change the audit record must
 * reflect whether or not anyone can be reached. The finding moves to `overdue`
 * so it shows as such wherever findings are listed, and the transition is
 * appended to the action's own history so the audit trail explains itself.
 *
 * Idempotent — `escalated_at is null` means a run that fires twice in a day
 * escalates nothing the second time.
 */
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
          'at', now(),
          'event', 'escalated',
          'detail', format('Target date %s passed with status %s.', ca.target_date, ca.status)
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

/**
 * Records the effectiveness review of a corrective action.
 *
 * A guarded transition rather than a bare update: ISO 45001 closure is not
 * "someone set a column", it is a reviewer deciding, on a date, whether the
 * action worked — and only an action that has actually been submitted can be
 * reviewed. Rejecting reopens it for the responsible person rather than
 * closing it, which is the whole point of an effectiveness check.
 */
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

  -- The caller must be able to see the row under RLS; security definer would
  -- otherwise let any authenticated user review another tenant's action.
  if ca.tenant_id <> public.current_tenant_id() and not public.is_super_admin() then
    raise exception 'That corrective action belongs to another organization.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Closing out an action nobody submitted would record a review of nothing.
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
      -- An accepted action is done; a rejected one is live again, so its
      -- escalation clock restarts from the next target date.
      closed_date = case when p_effective then current_date else null end,
      escalated_at = case when p_effective then escalated_at else null end,
      history = coalesce(history, '[]'::jsonb) || jsonb_build_object(
        'at', now(),
        'event', case when p_effective then 'effectiveness_accepted' else 'effectiveness_rejected' end,
        'by', reviewer,
        'detail', p_result
      )
  where id = p_corrective_action_id
  returning * into ca;

  -- A finding only closes when its corrective action was proven effective.
  update public.findings
  set status = case when p_effective then 'closed'::public.finding_status else 'ca_review'::public.finding_status end,
      closed_at = case when p_effective then now() else null end,
      actual_closure_date = case when p_effective then current_date else null end
  where id = ca.finding_id;

  return ca;
end;
$$;

grant execute on function public.record_effectiveness_review(uuid, boolean, text, text) to authenticated;
