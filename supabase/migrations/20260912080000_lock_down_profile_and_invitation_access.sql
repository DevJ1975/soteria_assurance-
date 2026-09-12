-- Closes the privilege-escalation path through `profiles`, and gives tenant
-- admins the invitation permissions the invite Edge Function already assumes.

-- `current_tenant_id()` answers "which tenant", but authorisation also needs
-- "which role", read without tripping over the RLS policies on profiles.
create or replace function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

-- `users_can_update_own_profile` had no WITH CHECK, so Postgres reused the
-- USING expression as the check. That constrained `id` and nothing else, which
-- left `role` and `tenant_id` writable by the row's own owner — and `role` is
-- exactly what `is_super_admin()` reads. Two PATCHes against /rest/v1/profiles
-- with an ordinary session JWT turned a viewer into a platform super_admin and
-- then moved them into any tenant.
--
-- The replacement pins both columns to the values already stored: a WITH CHECK
-- subquery sees the statement's starting snapshot, so `role` and `tenant_id`
-- must still equal what they were before the UPDATE. Everything else on the
-- row (display_name, avatar_url, ...) stays self-service.
--
-- Legitimate role changes are unaffected: a super_admin satisfies the separate
-- `super_admin_can_update_profiles` policy, and permissive policies are OR'd.
drop policy if exists users_can_update_own_profile on public.profiles;
create policy users_can_update_own_profile on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_profile_role()
    and tenant_id = public.current_tenant_id()
  );

-- Reading invitations was `is_super_admin() or tenant_id = current_tenant_id()`.
-- The second branch carried no role predicate, so every member of a tenant —
-- down to viewer and auditee — could enumerate pending invitees and the role
-- each was being granted. Invitee email plus intended role is exactly the pair
-- worth withholding.
drop policy if exists super_admin_can_read_invitations on public.auditor_invitations;
create policy admins_can_read_invitations on public.auditor_invitations
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_profile_role() = 'tenant_admin'
    )
  );

-- The invite Edge Function lets a tenant_admin invite into their own tenant,
-- but UPDATE was super_admin-only — so a tenant admin could create an
-- invitation and then had no way to revoke it. Revocation is an UPDATE that
-- sets status, and `handle_invited_user` only matches rows still `pending`,
-- so revoking immediately invalidates a link already sitting in an inbox.
drop policy if exists super_admin_can_update_invitations on public.auditor_invitations;
create policy admins_can_update_invitations on public.auditor_invitations
  for update
  to authenticated
  using (
    public.is_super_admin()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_profile_role() = 'tenant_admin'
    )
  )
  with check (
    public.is_super_admin()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_profile_role() = 'tenant_admin'
    )
  );
