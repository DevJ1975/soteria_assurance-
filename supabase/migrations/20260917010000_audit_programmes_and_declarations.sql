-- Audit programmes (certification cycles), and per-engagement competence and
-- impartiality declarations.
--
-- THE GAP THIS CLOSES
-- grep for impartial, conflict_of_interest, competence, audit_programme and
-- certification_cycle across the migrations and the type model returned zero
-- matches. The data model supported individual audits and nothing above or
-- around them:
--
--   * No PROGRAMME. Initial certification, surveillance and recertification
--     audits stood alone with no link to the certification decision they hang
--     off (ISO/IEC 17021-1 §9.1.2; ISO 19011 §5). "Were all clauses covered
--     across the three-year cycle?" was unanswerable from the data.
--   * No IMPARTIALITY record. 17021-1 §5.2 requires threats to impartiality to
--     be analysed and recorded per engagement.
--   * No COMPETENCE record per engagement. 17021-1 §7.1–7.2 require the CB to
--     demonstrate the assigned team is competent for the scope and sector.
--     `profiles.qualifications` holds the certificates; nothing recorded that
--     they were considered for THIS audit.
--
-- These are the records an accreditation assessor asks for first. A CB using
-- Soteria as its audit-record system could not produce them from the tool.

-- ---------------------------------------------------------------------------
-- 1. Audit programmes
-- ---------------------------------------------------------------------------
create table if not exists public.audit_programmes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  standard_id text not null default 'iso45001' references public.standards(id),

  cycle_start date not null,
  cycle_end date not null,
  status text not null default 'planned'
    check (status in ('planned','active','suspended','withdrawn','completed')),

  -- The certification decision is made by someone OTHER than the audit team
  -- (17021-1 §9.5). Enforced by trigger below, not just documented.
  certification_decision text not null default 'pending'
    check (certification_decision in ('pending','granted','refused','suspended','withdrawn')),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_notes text,

  notes text not null default '',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint audit_programmes_cycle_check check (cycle_end > cycle_start)
);

create index if not exists audit_programmes_tenant_active_idx
  on public.audit_programmes (tenant_id) where deleted_at is null;
create index if not exists audit_programmes_client_idx
  on public.audit_programmes (client_id) where deleted_at is null;

alter table public.audits
  add column if not exists programme_id uuid references public.audit_programmes(id) on delete set null;
create index if not exists audits_programme_idx on public.audits (programme_id);

comment on table public.audit_programmes is
  'One client''s certification cycle against one standard (ISO/IEC 17021-1 9.1.2). '
  'Initial, surveillance and recertification audits link here via audits.programme_id.';

-- ---------------------------------------------------------------------------
-- 2. Per-engagement auditor declarations
-- ---------------------------------------------------------------------------
create table if not exists public.auditor_declarations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  auditor_id uuid not null references public.profiles(id) on delete restrict,
  -- Denormalized, so the record survives the auditor leaving. Same lesson as
  -- findings.raised_by_auditor_name.
  auditor_name text not null,

  competence_statement text not null default '',

  has_conflict boolean not null default false,
  conflict_details text not null default '',
  mitigation text not null default '',
  declared_at timestamptz not null default now(),

  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_outcome text check (review_outcome is null or review_outcome in ('accepted','rejected')),
  review_notes text,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One declaration per auditor per audit. A change is an amendment to it.
  constraint auditor_declarations_one_per_auditor unique (audit_id, auditor_id),

  -- A conflict must say what it is, and a review must say who did it.
  constraint auditor_declarations_conflict_detail_check
    check (not has_conflict or length(conflict_details) > 0),
  constraint auditor_declarations_review_complete_check
    check ((reviewed_by is null) = (reviewed_at is null)
       and (reviewed_by is null) = (review_outcome is null))
);

create index if not exists auditor_declarations_audit_idx
  on public.auditor_declarations (audit_id) where deleted_at is null;

comment on table public.auditor_declarations is
  'Per-audit competence and impartiality declaration for each team member '
  '(ISO/IEC 17021-1 5.2, 7.1-7.2), reviewed by someone other than the declarant.';

-- ---------------------------------------------------------------------------
-- 3. Independence rules, enforced
-- ---------------------------------------------------------------------------
-- A self-reviewed impartiality declaration proves nothing. This is the kind of
-- rule that is easy to state in a document and easy to forget in a form, so it
-- lives where a form cannot bypass it.
create or replace function public.reject_self_review_of_declaration()
returns trigger
language plpgsql
as $$
begin
  if new.reviewed_by is not null and new.reviewed_by = new.auditor_id then
    raise exception 'An auditor cannot review their own impartiality declaration.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists auditor_declarations_no_self_review on public.auditor_declarations;
create trigger auditor_declarations_no_self_review
  before insert or update on public.auditor_declarations
  for each row execute function public.reject_self_review_of_declaration();

-- The certification decision maker must not have been on the audit team for
-- any audit in the cycle (17021-1 §9.5.1). Checked against both the lead
-- auditor column and the audit_team jsonb.
create or replace function public.reject_decision_by_audit_team()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.decided_by is null then
    return new;
  end if;
  if exists (
    select 1
      from public.audits a
     where a.programme_id = new.id
       and a.deleted_at is null
       and (
         a.lead_auditor_id = new.decided_by
         or exists (
           select 1 from jsonb_array_elements(coalesce(a.audit_team, '[]'::jsonb)) m
            where (m ->> 'userId')::uuid = new.decided_by
         )
       )
  ) then
    raise exception
      'The certification decision must be made by someone who was not on the audit team for this cycle.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_programmes_independent_decision on public.audit_programmes;
create trigger audit_programmes_independent_decision
  before insert or update of decided_by, certification_decision on public.audit_programmes
  for each row execute function public.reject_decision_by_audit_team();

-- ---------------------------------------------------------------------------
-- 4. RLS, grants, triggers — same shape as every other business table
-- ---------------------------------------------------------------------------
alter table public.audit_programmes enable row level security;
alter table public.auditor_declarations enable row level security;

create policy tenant_members_can_read_audit_programmes on public.audit_programmes
  for select using (tenant_id = public.current_tenant_id() and deleted_at is null);
create policy writers_can_insert_audit_programmes on public.audit_programmes
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor']::public.user_role[])
  );
create policy writers_can_update_audit_programmes on public.audit_programmes
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor']::public.user_role[])
  ) with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor']::public.user_role[])
  );

create policy tenant_members_can_read_auditor_declarations on public.auditor_declarations
  for select using (tenant_id = public.current_tenant_id() and deleted_at is null);
-- Any auditing role may DECLARE (insert their own); review columns are then
-- written by the reviewer through the same update policy, with the trigger
-- above stopping self-review.
create policy writers_can_insert_auditor_declarations on public.auditor_declarations
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[])
  );
create policy writers_can_update_auditor_declarations on public.auditor_declarations
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[])
  ) with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[])
  );

grant select, insert, update on public.audit_programmes to authenticated, service_role;
grant select, insert, update on public.auditor_declarations to authenticated, service_role;

create trigger audit_programmes_set_updated_at
  before update on public.audit_programmes
  for each row execute function public.set_updated_at();
create trigger auditor_declarations_set_updated_at
  before update on public.auditor_declarations
  for each row execute function public.set_updated_at();

create trigger audit_programmes_audit_log
  after insert or update or delete on public.audit_programmes
  for each row execute function public.log_core_table_change();
create trigger auditor_declarations_audit_log
  after insert or update or delete on public.auditor_declarations
  for each row execute function public.log_core_table_change();
