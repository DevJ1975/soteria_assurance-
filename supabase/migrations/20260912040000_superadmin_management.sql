create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.auditor_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.user_role not null default 'auditor',
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (tenant_id, email)
);

create index auditor_invitations_tenant_idx on public.auditor_invitations(tenant_id);
alter table public.auditor_invitations enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
      and is_active
  );
$$;

create policy super_admin_can_read_all_tenants on public.tenants
  for select using (public.is_super_admin());
create policy super_admin_can_insert_tenants on public.tenants
  for insert with check (public.is_super_admin());
create policy super_admin_can_update_tenants on public.tenants
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy super_admin_can_read_all_profiles on public.profiles
  for select using (public.is_super_admin());
create policy super_admin_can_insert_profiles on public.profiles
  for insert with check (public.is_super_admin());
create policy super_admin_can_update_profiles on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

create policy super_admin_can_read_invitations on public.auditor_invitations
  for select using (public.is_super_admin() or tenant_id = public.current_tenant_id());
create policy super_admin_can_insert_invitations on public.auditor_invitations
  for insert with check (public.is_super_admin() and invited_by = auth.uid());
create policy super_admin_can_update_invitations on public.auditor_invitations
  for update using (public.is_super_admin()) with check (public.is_super_admin());
