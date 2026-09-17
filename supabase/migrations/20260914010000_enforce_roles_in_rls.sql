-- Puts the RBAC matrix into the database, where it is actually enforced.
--
-- THE BUG THIS CLOSES
-- Every policy on the six business tables was tenant-scoped ONLY:
--   using (tenant_id = public.current_tenant_id())
-- with no reference to the caller's role. So any authenticated member of a
-- tenant — including `auditee`, the organization being audited, and `viewer` —
-- could INSERT, UPDATE and DELETE findings, audits, evidence, clause
-- assessments and corrective actions over PostgREST, while the UI correctly
-- showed them a read-only screen.
--
-- Verified against a running stack before this migration: signed in as an
-- `auditee`, a PATCH rewrote the nonconformity statement of the Major NC
-- raised against them, a DELETE removed a finding outright, and a `viewer`
-- edited the audit scope. All three returned success.
--
-- That makes every audit record this product produces indefensible: a
-- certification body cannot demonstrate who was permitted to write the record,
-- and the audited party can rewrite the findings against them. ISO/IEC
-- 17021-1 §9.1 (impartiality) and ISO 45001 §7.5.3 (protection of documented
-- information from unintended alteration) both fail on this.
--
-- `packages/core/src/constants/rbac.ts` already held the correct matrix. It
-- gated nothing: its only two consumers render it as text. This migration
-- makes it true.
--
--   | Permission                | SA | TA | LA | AU | AE | VW |
--   | Create audits             | Y  | Y  | Y  | -  | -  | -  |
--   | Conduct audits            | Y  | Y  | Y  | Y  | -  | -  |
--   | Add findings              | Y  | Y  | Y  | Y  | -  | -  |
--   | Close NCs                 | Y  | Y  | Y  | -  | -  | -  |
--   | Manage corrective actions | Y  | Y  | Y  | Y  | Y  | -  |
--   | View audit reports        | Y  | Y  | Y  | Y  | Y  | Y  |
--
-- READS are unchanged: every role may read its own tenant's data, which is
-- what `view_audit_reports` grants across the board.

-- ---------------------------------------------------------------------------
-- 1. Role predicate helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because it reads `profiles`, which is itself RLS-protected;
-- a policy that had to pass RLS to evaluate RLS would recurse. STABLE so the
-- planner evaluates it once per statement rather than per row.
create or replace function public.current_role_in(variadic allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.current_profile_role() = any(allowed);
$$;

comment on function public.current_role_in(public.user_role[]) is
  'True when the caller''s active profile role is one of `allowed`. The single '
  'source of role enforcement in RLS; mirrors ROLE_PERMISSIONS in '
  'packages/core/src/constants/rbac.ts.';

revoke execute on function public.current_role_in(public.user_role[]) from public;
grant execute on function public.current_role_in(public.user_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Replace the role-blind write policies
-- ---------------------------------------------------------------------------
-- Reads stay open to every tenant member; writes carry a role predicate
-- alongside the tenant predicate. DELETE is dropped entirely and replaced by
-- soft deletion in section 3 — an audit record is not something the API should
-- be able to destroy.
do $$
declare
  t text;
  -- Roles permitted to write each table, from the matrix above.
  writers jsonb := jsonb_build_object(
    'clients',            array['super_admin','tenant_admin','lead_auditor'],
    'audits',             array['super_admin','tenant_admin','lead_auditor'],
    'findings',           array['super_admin','tenant_admin','lead_auditor','auditor'],
    'clause_assessments', array['super_admin','tenant_admin','lead_auditor','auditor'],
    'evidence',           array['super_admin','tenant_admin','lead_auditor','auditor'],
    -- The auditee submits their own corrective action. That is correct and
    -- required: ISO 45001 clause 10.2 puts the corrective action with the
    -- organization, not the auditor. They still cannot touch the finding.
    'corrective_actions', array['super_admin','tenant_admin','lead_auditor','auditor','auditee']
  );
  role_list text;
begin
  foreach t in array array['clients','audits','findings','corrective_actions','clause_assessments','evidence']
  loop
    role_list := (
      select string_agg(format('%L', value), ', ')
      from jsonb_array_elements_text(writers -> t) as value
    );

    execute format('drop policy if exists tenant_members_can_insert_%1$s on public.%1$s', t);
    execute format('drop policy if exists tenant_members_can_update_%1$s on public.%1$s', t);
    execute format('drop policy if exists tenant_members_can_delete_%1$s on public.%1$s', t);

    execute format(
      'create policy writers_can_insert_%1$s on public.%1$s for insert
         with check (tenant_id = public.current_tenant_id()
                     and public.current_role_in(%2$s))',
      t, format('variadic array[%s]::public.user_role[]', role_list)
    );

    execute format(
      'create policy writers_can_update_%1$s on public.%1$s for update
         using (tenant_id = public.current_tenant_id()
                and public.current_role_in(%2$s))
         with check (tenant_id = public.current_tenant_id()
                     and public.current_role_in(%2$s))',
      t, format('variadic array[%s]::public.user_role[]', role_list)
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retention: soft deletion replaces destruction
-- ---------------------------------------------------------------------------
-- Before this, `delete from audits where id = ...` was one unprivileged API
-- call, and FK cascades took every finding, clause assessment, corrective
-- action, evidence row and report with it. ISO 45001 §7.5.3 requires retention
-- AND disposition to be controlled; ISO/IEC 17021-1 §8.4 requires audit records
-- to be retained across the certification cycle. Disposition must be a
-- deliberate, authorised, recorded act — not a verb every member can reach.
alter table public.clients            add column if not exists deleted_at timestamptz;
alter table public.audits             add column if not exists deleted_at timestamptz;
alter table public.findings           add column if not exists deleted_at timestamptz;
alter table public.clause_assessments add column if not exists deleted_at timestamptz;
alter table public.evidence           add column if not exists deleted_at timestamptz;
alter table public.corrective_actions add column if not exists deleted_at timestamptz;

comment on column public.audits.deleted_at is
  'Soft deletion. Hard DELETE is not reachable through the API on this table; '
  'set this instead. Read policies hide non-null rows.';

-- Reads hide soft-deleted rows. Replacing the read policy rather than adding a
-- second one matters: multiple PERMISSIVE policies are OR-ed, so an additional
-- policy would widen access rather than narrow it.
do $$
declare t text;
begin
  foreach t in array array['clients','audits','findings','corrective_actions','clause_assessments','evidence']
  loop
    execute format('drop policy if exists tenant_members_can_read_%1$s on public.%1$s', t);
    execute format(
      'create policy tenant_members_can_read_%1$s on public.%1$s for select
         using (tenant_id = public.current_tenant_id() and deleted_at is null)',
      t
    );
    -- Indexes on the predicate every read now carries.
    execute format(
      'create index if not exists %1$s_tenant_active_idx on public.%1$s (tenant_id) where deleted_at is null',
      t
    );
  end loop;
end;
$$;

-- Retention period, so disposition has a defined boundary rather than being
-- implicit. Three years is the ISO/IEC 17021-1 certification cycle; disposal is
-- deliberately NOT automated — nothing schedules a purge. The column exists so
-- the period is recorded and auditable.
alter table public.tenants
  add column if not exists record_retention_years integer not null default 3;

alter table public.tenants
  drop constraint if exists tenants_record_retention_years_check;
alter table public.tenants
  add constraint tenants_record_retention_years_check
  check (record_retention_years >= 3);

comment on column public.tenants.record_retention_years is
  'Minimum retention for audit records, in years. Floor of 3 is the '
  'ISO/IEC 17021-1 certification cycle. Nothing purges automatically.';

-- ---------------------------------------------------------------------------
-- 4. Lifecycle lock: an issued report freezes the record behind it
-- ---------------------------------------------------------------------------
-- Findings and clause assessments belonging to an audit in `report_issued` or
-- `closed` could be edited in place, so the stored PDF and the live record
-- could diverge with nothing marking which superseded which. Once a report is
-- issued the record is frozen; a change requires a re-issue, not a silent edit.
create or replace function public.reject_write_to_issued_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  parent_status public.audit_status;
begin
  select status into parent_status
    from public.audits
   where id = coalesce(new.audit_id, old.audit_id);

  -- Soft-deleting is still permitted; destroying history is not the concern
  -- here, silently rewriting an issued finding is.
  if tg_op = 'UPDATE'
     and new.deleted_at is not distinct from old.deleted_at
     and parent_status in ('report_issued', 'closed') then
    raise exception
      'Audit % is %; its findings and assessments are frozen. Re-issue the report to amend it.',
      coalesce(new.audit_id, old.audit_id), parent_status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists lock_findings_after_issue on public.findings;
create trigger lock_findings_after_issue
  before update on public.findings
  for each row execute function public.reject_write_to_issued_audit();

drop trigger if exists lock_assessments_after_issue on public.clause_assessments;
create trigger lock_assessments_after_issue
  before update on public.clause_assessments
  for each row execute function public.reject_write_to_issued_audit();

-- ---------------------------------------------------------------------------
-- 5. The enum CHECKs that 20260913050000 skipped
-- ---------------------------------------------------------------------------
-- That migration added CHECKs to six columns to stop out-of-union values being
-- written and cast straight through the typed row mappers. It missed the two
-- columns that determine whether an audit is a stage 1, stage 2, surveillance
-- or recertification — which is precisely what every downstream statement about
-- the certification cycle depends on — and findings.severity.
--
-- Added NOT VALID for the same reason as the originals: existing rows are not
-- rechecked, forward writes are. Section 6 then validates them.
alter table public.audits drop constraint if exists audits_audit_type_check;
alter table public.audits add constraint audits_audit_type_check
  check (audit_type in ('initial_certification','surveillance','recertification','internal','special'))
  not valid;

alter table public.audits drop constraint if exists audits_audit_stage_check;
alter table public.audits add constraint audits_audit_stage_check
  check (audit_stage in ('stage_1','stage_2','not_applicable'))
  not valid;

alter table public.findings drop constraint if exists findings_severity_check;
alter table public.findings add constraint findings_severity_check
  check (severity is null or severity in ('major','minor'))
  not valid;

-- ---------------------------------------------------------------------------
-- 6. Validate the constraints left NOT VALID
-- ---------------------------------------------------------------------------
-- 20260913050000 left six CHECKs unvalidated because live seed data already
-- held an off-union value ('5why'). A NOT VALID constraint guards forward
-- writes only, which is a false sense of a guarantee it half holds. Clean the
-- known bad value, then validate everything.
update public.corrective_actions
   set root_cause_method = 'five_why'
 where root_cause_method in ('5why', '5_whys', 'five_whys');

do $$
declare
  c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'c'
       and connamespace = 'public'::regnamespace
       and not convalidated
  loop
    begin
      execute format('alter table %s validate constraint %I', c.tbl, c.conname);
    exception when check_violation then
      -- Report rather than fail the migration: a pre-existing bad row is a
      -- data problem to fix deliberately, not a reason to block deployment.
      raise warning 'Constraint %.% still has violating rows; left NOT VALID.', c.tbl, c.conname;
    end;
  end loop;
end;
$$;
