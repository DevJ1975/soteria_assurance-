-- Audit findings: append-only change history, complete clause assessment
-- persistence, and tenant-scoped storage for uploaded artifacts.

-- Clause assessments are also written by the offline mobile client. Keep the
-- server shape in sync with the local model without changing existing rows.
alter table public.clause_assessments
  add column if not exists ai_generated_summary text,
  add column if not exists evidence_ids uuid[] not null default '{}',
  add column if not exists finding_ids uuid[] not null default '{}';

create index if not exists clause_assessments_tenant_audit_clause_idx
  on public.clause_assessments(tenant_id, audit_id, clause_number);

-- A single append-only history table covers the domain tables. JSON snapshots
-- preserve the exact before/after values without coupling the log to schema
-- changes in those tables.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx
  on public.audit_logs(tenant_id, created_at desc);
create index if not exists audit_logs_record_idx
  on public.audit_logs(table_name, record_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy tenant_members_can_read_audit_logs
  on public.audit_logs for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create or replace function public.log_core_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  log_tenant_id uuid;
  log_record_id uuid;
begin
  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  log_tenant_id := (row_data ->> 'tenant_id')::uuid;
  log_record_id := (row_data ->> 'id')::uuid;

  insert into public.audit_logs (
    tenant_id, actor_id, table_name, record_id, operation, old_data, new_data
  )
  values (
    log_tenant_id,
    auth.uid(),
    TG_TABLE_NAME,
    log_record_id,
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) end
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants', 'profiles', 'clients', 'audits', 'findings',
    'corrective_actions', 'clause_assessments', 'evidence'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_audit_log',
      table_name
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.log_core_table_change()',
      table_name || '_audit_log',
      table_name
    );
  end loop;
end;
$$;

-- The history itself cannot be changed through the API, including by a
-- mistaken client call. The trigger function above is SECURITY DEFINER.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_log_mutation();

-- Keep storage private. Every object must use the tenant id as its first path
-- segment (for example: <tenant-id>/<audit-id>/photo.jpg).
insert into storage.buckets (id, name, public)
values
  ('evidence', 'evidence', false),
  ('signatures', 'signatures', false),
  ('reports', 'reports', false),
  ('corrective-action-evidence', 'corrective-action-evidence', false)
on conflict (id) do update set public = excluded.public;

do $$
declare
  bucket_name text;
begin
  foreach bucket_name in array array[
    'evidence', 'signatures', 'reports', 'corrective-action-evidence'
  ]
  loop
    execute format(
      'create policy %I on storage.objects for select to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = (public.current_tenant_id())::text)',
      bucket_name || '_tenant_read',
      bucket_name
    );
    execute format(
      'create policy %I on storage.objects for insert to authenticated
       with check (bucket_id = %L and (storage.foldername(name))[1] = (public.current_tenant_id())::text)',
      bucket_name || '_tenant_insert',
      bucket_name
    );
    execute format(
      'create policy %I on storage.objects for update to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = (public.current_tenant_id())::text)
       with check (bucket_id = %L and (storage.foldername(name))[1] = (public.current_tenant_id())::text)',
      bucket_name || '_tenant_update',
      bucket_name,
      bucket_name
    );
    execute format(
      'create policy %I on storage.objects for delete to authenticated
       using (bucket_id = %L and (storage.foldername(name))[1] = (public.current_tenant_id())::text)',
      bucket_name || '_tenant_delete',
      bucket_name
    );
  end loop;
end;
$$;
