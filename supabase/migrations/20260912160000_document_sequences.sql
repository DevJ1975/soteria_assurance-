-- Atomic per-tenant document numbering.
--
-- Both `generateAuditNumber` and the inline finding-number builder were seeded
-- from `Math.floor(Math.random() * 900) + 1` — a 1-in-900 chance of collision
-- on every single save, against `UNIQUE (tenant_id, audit_number)` and
-- `UNIQUE (tenant_id, finding_number)`. Not a rare edge case: a tenant running
-- a few hundred audits a year hits it routinely, and the failure mode is a
-- silent-looking insert error on the very action ("raise a finding") this
-- product exists to support.
--
-- One row per (tenant, prefix, year) holds the next sequence value. The
-- upsert's row-level lock is what makes concurrent callers get distinct
-- numbers rather than a race on client-computed sequences.
create table if not exists public.document_sequences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  prefix text not null,
  year integer not null,
  next_seq integer not null default 1,
  primary key (tenant_id, prefix, year)
);

alter table public.document_sequences enable row level security;

-- No client policies at all: the only writer is next_document_seq() below,
-- which runs as its definer. A tenant member has no reason to read or write
-- this table directly.

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
  if p_tenant_id <> public.current_tenant_id() and not public.is_super_admin() then
    raise exception 'Cannot allocate a document number for another organization.'
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

grant execute on function public.next_document_seq(uuid, text, integer) to authenticated;
