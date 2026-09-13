-- Two data-integrity gaps found live:
--
-- 1. Five enum-like text columns have no CHECK constraint, unlike their six
--    sibling columns that are true Postgres enums — nothing stops a typo'd
--    or out-of-union value from being written and later cast straight
--    through the web app's typed mappers with no runtime validation.
-- 2. audit_logs' append-only trigger blocks its own foreign key: deleting a
--    profile that ever made a logged write fails outright, because
--    actor_id's `on delete set null` action is itself an UPDATE against
--    audit_logs, and the trigger unconditionally rejects every UPDATE.
--    Confirmed live: `delete from tenants where id = ...` on a tenant with
--    any real activity in it fails with "audit_logs is append-only" — there
--    was no way to delete a user or fully offboard a tenant once anyone in
--    it had done real work.

-- NOT VALID: this environment has live concurrent writers seeding test data
-- outside this migration's control, some of it already off-union (e.g. a
-- 'five_why' typo'd as '5why'). NOT VALID lets the constraint take effect for
-- every write from this point forward without a one-time validation pass
-- that would fail on pre-existing rows this migration has no business
-- rewriting. Run `alter table ... validate constraint ...` later once the
-- data is clean, if a hard guarantee against old rows is ever needed too.
alter table public.clients
  add constraint clients_certification_status_check
  check (certification_status in ('not_certified', 'certified', 'expired', 'suspended'))
  not valid;

alter table public.evidence
  add constraint evidence_type_check
  check (type in ('photo', 'video', 'document', 'screenshot', 'audio', 'signature'))
  not valid;

alter table public.corrective_actions
  add constraint corrective_actions_root_cause_method_check
  check (root_cause_method in ('five_why', '8d', 'fishbone', 'free_form'))
  not valid;

alter table public.clause_assessments
  add constraint clause_assessments_conformity_status_check
  check (conformity_status in ('conforming', 'major_nc', 'minor_nc', 'not_audited', 'not_applicable'))
  not valid;

alter table public.tenants
  add constraint tenants_subscription_tier_check
  check (subscription_tier in ('starter', 'professional', 'enterprise'))
  not valid;
alter table public.tenants
  add constraint tenants_subscription_status_check
  check (subscription_status in ('active', 'trialing', 'past_due', 'canceled'))
  not valid;

-- The only mutation this should ever let through is the FK's own SET NULL on
-- actor_id, and only when nothing else about the row changes — every other
-- column is compared old-to-new and must be identical for the UPDATE to
-- pass. DELETE stays fully blocked; deleting a log entry outright is never
-- legitimate.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.actor_id is null
     and OLD.actor_id is not null
     and NEW.id = OLD.id
     and NEW.tenant_id = OLD.tenant_id
     and NEW.table_name = OLD.table_name
     and NEW.record_id = OLD.record_id
     and NEW.operation = OLD.operation
     and NEW.old_data is not distinct from OLD.old_data
     and NEW.new_data is not distinct from OLD.new_data
     and NEW.created_at = OLD.created_at
  then
    return NEW;
  end if;

  raise exception 'audit_logs is append-only';
end;
$$;
