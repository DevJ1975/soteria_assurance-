create extension if not exists "pgcrypto";

create type public.tenant_type as enum ('certification_body', 'consultancy', 'enterprise');
create type public.user_role as enum ('super_admin', 'tenant_admin', 'lead_auditor', 'auditor', 'auditee', 'viewer');
create type public.audit_status as enum ('planned', 'in_progress', 'findings_review', 'report_pending', 'report_issued', 'closed', 'canceled');
create type public.finding_type as enum ('major_nc', 'minor_nc', 'ofi', 'strong_point', 'observation');
create type public.finding_status as enum ('open', 'acknowledged', 'ca_submitted', 'ca_review', 'closed', 'overdue');
create type public.ca_status as enum ('pending', 'in_progress', 'submitted', 'accepted', 'rejected', 'closed');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.tenant_type not null,
  logo text,
  subscription_tier text not null default 'starter',
  subscription_status text not null default 'trialing',
  max_auditors integer not null default 5,
  max_audits_per_month integer not null default 10,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  avatar_url text,
  role public.user_role not null default 'viewer',
  qualifications jsonb not null default '[]'::jsonb,
  client_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_name text not null,
  industry text not null default '',
  address jsonb not null default '{}'::jsonb,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  number_of_employees integer not null default 0,
  number_of_sites integer not null default 0,
  sites jsonb not null default '[]'::jsonb,
  certification_status text not null default 'not_certified',
  certification_body text,
  certification_expiry date,
  audit_history uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  audit_number text not null,
  audit_type text not null,
  audit_stage text not null default 'not_applicable',
  standard text not null default 'ISO 45001:2018',
  scope text not null,
  status public.audit_status not null default 'planned',
  lead_auditor_id uuid references public.profiles(id) on delete set null,
  audit_team jsonb not null default '[]'::jsonb,
  management_representative_id uuid,
  management_representative_name text not null default '',
  planned_start_date date not null,
  planned_end_date date not null,
  actual_start_date date,
  actual_end_date date,
  audit_days numeric not null default 1,
  sites_in_scope uuid[] not null default '{}',
  audit_plan jsonb not null default '{}'::jsonb,
  findings jsonb not null default '{}'::jsonb,
  ai_certification_readiness_score integer,
  ai_risk_flags text[] not null default '{}',
  confidentiality text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  report_issued_at timestamptz,
  unique (tenant_id, audit_number)
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  finding_number text not null,
  type public.finding_type not null,
  severity text,
  clause_number text not null,
  clause_title text not null,
  requirement text not null,
  title text not null,
  objective_evidence text not null default '',
  nonconformity_statement text not null default '',
  ai_draft_statement text,
  site_id uuid,
  department text,
  area text,
  evidence_ids uuid[] not null default '{}',
  raised_by_auditor_id uuid references public.profiles(id) on delete set null,
  raised_by_auditor_name text not null default '',
  raised_at timestamptz not null default now(),
  acknowledged_by_name text,
  acknowledged_by_signature_url text,
  acknowledged_at timestamptz,
  corrective_action_id uuid,
  corrective_action_status public.ca_status,
  target_closure_date date,
  actual_closure_date date,
  status public.finding_status not null default 'open',
  closed_at timestamptz,
  closed_by_auditor_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, finding_number)
);

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  audit_id uuid not null references public.audits(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  ca_number text not null,
  title text not null,
  root_cause_method text not null,
  root_cause_analysis text not null default '',
  immediate_action text not null default '',
  corrective_action text not null default '',
  preventive_action text not null default '',
  effectiveness_check text not null default '',
  effectiveness_check_date date,
  effectiveness_result text,
  responsible_person_name text not null default '',
  responsible_person_email text not null default '',
  target_date date not null,
  submitted_date date,
  reviewed_date date,
  closed_date date,
  closure_evidence_ids uuid[] not null default '{}',
  closure_notes text,
  reviewed_by_auditor_id uuid references public.profiles(id) on delete set null,
  review_notes text,
  status public.ca_status not null default 'pending',
  ai_root_cause_suggestion text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ca_number)
);

create table public.clause_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  clause_number text not null,
  clause_title text not null,
  assigned_auditor_id uuid references public.profiles(id) on delete set null,
  conformity_status text not null,
  score numeric not null default 0,
  auditor_notes text not null default '',
  sub_clause_notes jsonb not null default '[]'::jsonb,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, clause_number)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null default '',
  file_url text not null,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null,
  thumbnail_url text,
  captured_at timestamptz not null default now(),
  captured_by_auditor_id uuid references public.profiles(id) on delete set null,
  geo_location jsonb,
  clause_numbers text[] not null default '{}',
  finding_ids uuid[] not null default '{}',
  ai_analysis text,
  ai_hazards_detected text[] not null default '{}',
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by_auditor_id uuid references public.profiles(id) on delete set null
);

create index profiles_tenant_id_idx on public.profiles(tenant_id);
create index clients_tenant_id_idx on public.clients(tenant_id);
create index audits_tenant_id_idx on public.audits(tenant_id);
create index audits_client_id_idx on public.audits(client_id);
create index findings_tenant_audit_idx on public.findings(tenant_id, audit_id);
create index corrective_actions_tenant_idx on public.corrective_actions(tenant_id);
create index clause_assessments_audit_idx on public.clause_assessments(tenant_id, audit_id);
create index evidence_audit_idx on public.evidence(tenant_id, audit_id);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at before update on public.tenants
for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger audits_updated_at before update on public.audits
for each row execute function public.set_updated_at();
create trigger findings_updated_at before update on public.findings
for each row execute function public.set_updated_at();
create trigger corrective_actions_updated_at before update on public.corrective_actions
for each row execute function public.set_updated_at();
create trigger clause_assessments_updated_at before update on public.clause_assessments
for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.audits enable row level security;
alter table public.findings enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.clause_assessments enable row level security;
alter table public.evidence enable row level security;

create policy tenant_members_can_read on public.tenants for select using (id = public.current_tenant_id());
create policy tenant_members_can_update on public.tenants for update using (id = public.current_tenant_id());
create policy users_can_read_tenant_profiles on public.profiles for select using (tenant_id = public.current_tenant_id());
create policy users_can_update_own_profile on public.profiles for update using (id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array['clients', 'audits', 'findings', 'corrective_actions', 'clause_assessments', 'evidence']
  loop
    execute format(
      'create policy tenant_members_can_read_%1$s on public.%1$s for select using (tenant_id = public.current_tenant_id())',
      table_name
    );
    execute format(
      'create policy tenant_members_can_insert_%1$s on public.%1$s for insert with check (tenant_id = public.current_tenant_id())',
      table_name
    );
    execute format(
      'create policy tenant_members_can_update_%1$s on public.%1$s for update using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      table_name
    );
    execute format(
      'create policy tenant_members_can_delete_%1$s on public.%1$s for delete using (tenant_id = public.current_tenant_id())',
      table_name
    );
  end loop;
end;
$$;
