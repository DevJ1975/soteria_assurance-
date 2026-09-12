-- Daily escalation of overdue corrective actions.
--
-- Scheduled in the database rather than from the reminder Edge Function
-- because escalation is a state the audit record must reflect whether or not
-- an email provider is reachable. The function chases people; this guarantees
-- the record is right.
--
-- Guarded so the migration still applies on a database without pg_cron (a
-- bare Postgres used for tests, for instance) — the function remains callable
-- by hand and by the Edge Function either way.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Unscheduled first so re-running the migration does not accumulate jobs.
    perform cron.unschedule('escalate-overdue-corrective-actions')
    where exists (
      select 1 from cron.job where jobname = 'escalate-overdue-corrective-actions'
    );

    -- 02:00 UTC: after any working day anywhere, before any working day
    -- anywhere, so an action is never escalated in the middle of the day its
    -- owner is still working on it.
    perform cron.schedule(
      'escalate-overdue-corrective-actions',
      '0 2 * * *',
      $job$ select public.escalate_overdue_corrective_actions(); $job$
    );
  else
    raise notice 'pg_cron unavailable; escalation must be invoked by the reminder function or by hand.';
  end if;
end;
$$;
