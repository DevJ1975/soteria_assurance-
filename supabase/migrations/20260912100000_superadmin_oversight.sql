-- Platform oversight for superadmins: cross-tenant activity, and the seat
-- accounting the tenant limits imply.

-- `tenant_members_can_read_audit_logs` scopes reads to the caller's own tenant,
-- which for a superadmin means the platform tenant they happen to sit in —
-- i.e. almost nothing. Platform oversight needs the whole log.
drop policy if exists super_admin_can_read_all_audit_logs on public.audit_logs;
create policy super_admin_can_read_all_audit_logs on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());

-- Deactivating a user must not orphan the tenant's only administrator, and the
-- console needs seat counts to show against `max_auditors`. Both are the same
-- aggregate, so it lives in one view rather than N+1 queries from the client.
create or replace view public.tenant_usage
with (security_invoker = true) as
select
  t.id as tenant_id,
  t.name,
  t.type,
  t.subscription_tier,
  t.subscription_status,
  t.max_auditors,
  t.max_audits_per_month,
  count(p.id) filter (where p.is_active) as active_members,
  count(p.id) filter (where p.is_active and p.role in ('lead_auditor','auditor')) as active_auditors,
  count(p.id) filter (where p.is_active and p.role = 'tenant_admin') as active_admins
from public.tenants t
left join public.profiles p on p.tenant_id = t.id
group by t.id;

-- `security_invoker` makes the view run with the caller's own permissions, so
-- the RLS on tenants and profiles still applies: a superadmin sees every row,
-- a tenant member sees only their own tenant.
grant select on public.tenant_usage to authenticated;

create index if not exists profiles_tenant_role_idx on public.profiles(tenant_id, role) where is_active;
