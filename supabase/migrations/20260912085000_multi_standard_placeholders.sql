-- Multi-standard foundation: register the management-system standards the
-- platform audits against, and make every audit and clause assessment name its
-- standard explicitly.
--
-- ISO 45001 is the only standard that is built. ISO 14001 and ISO 9001 are
-- registered as roadmap placeholders (`is_available = false`) so the schema,
-- the API and the UI already account for them; shipping either one becomes
-- clause-data authoring plus flipping that flag, with no further migration.
--
-- Before this migration `audits.standard` was unconstrained text defaulting to
-- 'ISO 45001:2018'. Display names now live in one place and rows carry a slug,
-- so an edition bump (e.g. ISO 45001:2018 -> :2029) is a single update here
-- rather than a rewrite of every audit row.

-- ---------------------------------------------------------------------------
-- Standards registry
-- ---------------------------------------------------------------------------

-- A lookup table rather than an enum or a check constraint: a placeholder needs
-- to be a row that exists and is explicitly not-yet-available, and it needs to
-- carry a display name and discipline. Neither an enum nor a check can do that.
-- This is global reference data, not tenant-owned.
create table if not exists public.standards (
  id           text primary key,
  name         text not null,
  short_name   text not null,
  discipline   text not null,
  -- false => registered roadmap placeholder; the UI shows a "coming soon" state
  -- and the standard cannot be selected for a new audit.
  is_available boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.standards is
  'Management-system standards the platform audits against. Mirrors the client-side registry in @soteria/core/standards; the two must agree.';

insert into public.standards (id, name, short_name, discipline, is_available, sort_order)
values
  ('iso45001', 'ISO 45001:2018', 'ISO 45001', 'Occupational Health & Safety', true,  1),
  ('iso14001', 'ISO 14001:2015', 'ISO 14001', 'Environmental',                false, 2),
  ('iso9001',  'ISO 9001:2015',  'ISO 9001',  'Quality',                      false, 3)
on conflict (id) do nothing;

-- Reference data is readable by every authenticated user regardless of tenant.
-- No insert/update/delete policies exist, so the catalogue is administered
-- through migrations only — deny-by-default does the rest.
alter table public.standards enable row level security;

drop policy if exists authenticated_can_read_standards on public.standards;
create policy authenticated_can_read_standards
  on public.standards
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- audits.standard_id
-- ---------------------------------------------------------------------------

alter table public.audits
  add column if not exists standard_id text;

-- Unconditional backfill: ISO 45001 is the only standard any existing row can
-- be, since it was the only one the product supported.
update public.audits
  set standard_id = 'iso45001'
  where standard_id is null;

alter table public.audits
  alter column standard_id set default 'iso45001',
  alter column standard_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audits_standard_id_fkey'
  ) then
    alter table public.audits
      add constraint audits_standard_id_fkey
      foreign key (standard_id) references public.standards(id);
  end if;
end
$$;

-- The display name now comes from public.standards / the core registry, so the
-- denormalized copy on each audit row is redundant.
alter table public.audits
  drop column if exists standard;

create index if not exists audits_tenant_standard_idx
  on public.audits(tenant_id, standard_id);

-- ---------------------------------------------------------------------------
-- clause_assessments.standard_id
-- ---------------------------------------------------------------------------

-- Denormalized from the parent audit. A clause number alone is ambiguous:
-- "6.1.2" exists in every Annex SL standard, so a row that carries only a
-- clause number cannot be interpreted without joining back to its audit.
alter table public.clause_assessments
  add column if not exists standard_id text;

update public.clause_assessments ca
  set standard_id = a.standard_id
  from public.audits a
  where ca.audit_id = a.id
    and ca.standard_id is null;

-- Covers any orphan rows the join above could not resolve.
update public.clause_assessments
  set standard_id = 'iso45001'
  where standard_id is null;

alter table public.clause_assessments
  alter column standard_id set default 'iso45001',
  alter column standard_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clause_assessments_standard_id_fkey'
  ) then
    alter table public.clause_assessments
      add constraint clause_assessments_standard_id_fkey
      foreign key (standard_id) references public.standards(id);
  end if;
end
$$;

-- NOTE: the existing unique (audit_id, clause_number) key is deliberately left
-- alone. One audit is conducted against exactly one standard, so clause numbers
-- are already unique within an audit. If integrated QHSE audits are introduced
-- later, that key becomes (audit_id, standard_id, clause_number).
create index if not exists clause_assessments_tenant_standard_idx
  on public.clause_assessments(tenant_id, standard_id);

-- ---------------------------------------------------------------------------
-- Tenant entitlement
-- ---------------------------------------------------------------------------

-- Which standards a tenant may run audits against. An array on tenants rather
-- than a join table: it rides the existing tenant_members_can_read policy on
-- public.tenants and needs no new RLS, and it matches the existing
-- evidence.clause_numbers text[] precedent.
--
-- Entitlement and readiness are separate gates — a standard listed here is
-- still only selectable when public.standards.is_available is true.
alter table public.tenants
  add column if not exists enabled_standards text[] not null default '{iso45001}';

comment on column public.tenants.enabled_standards is
  'Standard ids this tenant may audit against. Gated further by standards.is_available.';
