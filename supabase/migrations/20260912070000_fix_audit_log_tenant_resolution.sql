-- Fixes tenant resolution in the append-only audit log.
--
-- `log_core_table_change` read `tenant_id` off every logged row, but
-- `public.tenants` has no such column — a tenant IS the tenant, identified by
-- its own `id`. Inserting a tenant therefore tried to write a NULL
-- `audit_logs.tenant_id` and failed the NOT NULL constraint, which blocked
-- company creation in the superadmin console entirely.
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
  log_record_id := (row_data ->> 'id')::uuid;

  -- Every other logged table carries a `tenant_id`; the tenants table is its
  -- own tenant.
  log_tenant_id := case
    when TG_TABLE_NAME = 'tenants' then log_record_id
    else (row_data ->> 'tenant_id')::uuid
  end;

  -- A row that resolves to no tenant would abort the caller's write. The log
  -- must not be the reason a legitimate change fails, so the entry is skipped
  -- and the exception is left to the table's own constraints.
  if log_tenant_id is null then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

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

-- Deleting a tenant cascades to its own audit_logs rows, so the DELETE entry
-- for a tenant can never outlive it. Detach the log from the tenant row on
-- delete instead, so the record of the deletion survives.
alter table public.audit_logs
  drop constraint if exists audit_logs_tenant_id_fkey;
