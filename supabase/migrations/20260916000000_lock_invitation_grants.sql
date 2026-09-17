-- Closes a privilege-escalation path from tenant_admin to platform super_admin,
-- and makes an invitation's grant immutable once it has been issued.
--
-- THE BUG
-- `admins_can_update_invitations` (20260912080000) checks WHO is updating but
-- not WHAT they change:
--
--   using/with check:
--     is_super_admin()
--     or (tenant_id = current_tenant_id() and current_profile_role() = 'tenant_admin')
--
-- No column is pinned, so a tenant_admin could rewrite any pending invitation
-- in their own tenant — including its `email`, `role`, `status` and
-- `expires_at`. `handle_invited_user` then grants `invitation.role` verbatim,
-- and 'super_admin' is a member of public.user_role.
--
-- The invite-auditor Edge Function restricts assignable roles to
-- {tenant_admin, lead_auditor, auditor, viewer}, but that check lives in the
-- function; a direct PATCH to /rest/v1/auditor_invitations never runs it.
--
-- Confirmed live on this stack before the fix: a tenant_admin rewrote an
-- invitation to `role = 'super_admin'` with an attacker-controlled address,
-- registered it, and the trigger provisioned a profile with role super_admin —
-- is_super_admin() returned true and every tenant on the platform became
-- readable.
--
-- This is the same bug shape as the profiles fix in
-- 20260912080000_lock_down_profile_and_invitation_access.sql (a WITH CHECK that
-- constrains the row's owner but not its privileged columns). That migration
-- applied the lesson to profiles and, in the same breath, granted tenant admins
-- the invitation UPDATE without applying it here.
--
-- THE FIX, IN THREE INDEPENDENT LAYERS
-- Independent on purpose: each one alone stops the confirmed exploit, so a
-- future policy edit that reopens one does not reopen the hole.

-- ---------------------------------------------------------------------------
-- 1. An invitation can never grant platform super_admin. Path-independent.
-- ---------------------------------------------------------------------------
-- A CHECK constraint is not subject to RLS, is not bypassed by SECURITY
-- DEFINER, and applies to the service role too. super_admin is a platform role
-- held by staff; it is not, and has never been, something an invitation into a
-- customer tenant should be able to confer. Validated rather than NOT VALID:
-- there is no legitimate existing row this could be rejecting.
alter table public.auditor_invitations
  add constraint auditor_invitations_role_not_super_admin
  check (role <> 'super_admin');

comment on constraint auditor_invitations_role_not_super_admin on public.auditor_invitations is
  'super_admin is a platform role, never an invitation grant. See 20260916000000.';

-- ---------------------------------------------------------------------------
-- 2. The grant itself is immutable once issued; a tenant admin may only revoke.
-- ---------------------------------------------------------------------------
-- A trigger rather than more policy predicates, because a policy cannot compare
-- the new row against the old one — which is exactly the comparison needed. The
-- profiles fix had to approximate this with a subquery reading the pre-statement
-- snapshot; OLD/NEW says it directly.
--
-- SECURITY INVOKER is deliberate and load-bearing: it leaves `current_user` as
-- whatever role is actually executing, which is how the legitimate writers are
-- told apart from a client session.
--   * PostgREST session          -> current_user = 'authenticated'  -> enforced
--   * Edge Function service role -> current_user = 'service_role'   -> exempt
--   * create_or_renew_invitation -> SECURITY DEFINER, owned by the
--     migration role, so current_user is that owner                 -> exempt
--   * handle_invited_user        -> same, and it must be able to set
--     status = 'accepted'                                           -> exempt
create or replace function public.guard_invitation_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Only an ordinary API session is constrained. Every other writer here is
  -- server-side code that has already authorized the caller.
  if current_user <> 'authenticated' then
    return new;
  end if;

  -- A superadmin manages invitations through the console and the Edge
  -- Functions; they are not the threat this guards against.
  if public.is_super_admin() then
    return new;
  end if;

  -- Who an invitation is for, and what it grants, are fixed at issue time.
  -- Changing your mind means revoking and issuing a new one, which leaves a
  -- record of both — the point of an audit trail.
  if new.tenant_id   is distinct from old.tenant_id
     or lower(new.email) is distinct from lower(old.email)
     or new.role      is distinct from old.role
     or new.invited_by is distinct from old.invited_by
     or new.expires_at is distinct from old.expires_at
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_by is distinct from old.accepted_by
  then
    raise exception
      'An invitation''s organization, recipient, role and expiry are fixed once issued. Revoke it and send a new one.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Revocation is the one transition a tenant admin owns. Re-opening a spent
  -- invitation is how a revoked or already-accepted grant gets replayed.
  if new.status is distinct from old.status and new.status <> 'revoked' then
    raise exception 'An invitation can only be revoked, not re-opened.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Fires before auditor_invitations_revocation (triggers of the same timing run
-- in name order, and 'g' < 'r'), so the guard sees the row as the caller sent
-- it, before revoked_at is stamped onto it.
drop trigger if exists auditor_invitations_guard_update on public.auditor_invitations;
create trigger auditor_invitations_guard_update
  before update on public.auditor_invitations
  for each row execute function public.guard_invitation_update();

-- ---------------------------------------------------------------------------
-- 3. Provisioning refuses to mint a super_admin, whatever the row says.
-- ---------------------------------------------------------------------------
-- The last line of defence: the constraint in (1) covers rows written from now
-- on, but this function is what actually turns a row into a privilege. It
-- should not be the only thing standing between a bad row and a platform
-- admin, and it should not be reachable for that even if a row predating the
-- constraint exists.
--
-- Otherwise identical to the 20260913040000 version — the row lock and the
-- `status = 'pending'` re-check in the closing UPDATE are preserved verbatim.
create or replace function public.handle_invited_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.auditor_invitations%rowtype;
  invited_display_name text;
  applied public.auditor_invitations%rowtype;
begin
  select * into invitation
  from public.auditor_invitations
  where lower(email) = lower(new.email)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if invitation.id is null then
    return new;
  end if;

  -- Never provisioned from an invitation. A row claiming otherwise is either
  -- pre-constraint data or evidence of tampering; in both cases the safe
  -- outcome is no tenant assignment at all, which surfaces in the app as the
  -- organization-access-pending state.
  if invitation.role = 'super_admin' then
    raise warning 'Refusing to provision super_admin from invitation %', invitation.id;
    return new;
  end if;

  invited_display_name := coalesce(
    nullif(invitation.display_name, ''),
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, tenant_id, email, display_name, role)
  values (new.id, invitation.tenant_id, new.email, invited_display_name, invitation.role)
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = excluded.role,
        display_name = excluded.display_name,
        is_active = true;

  update public.auditor_invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = new.id
  where id = invitation.id
    and status = 'pending'
  returning * into applied;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Advisor cleanup: pin search_path on the remaining mutable functions.
-- ---------------------------------------------------------------------------
-- Flagged by Supabase's own security advisor (function_search_path_mutable).
-- A SECURITY DEFINER function without a pinned search_path can be induced to
-- resolve an unqualified name against a schema the caller controls. Only
-- set_updated_at and log_core_table_change run as definer here, but pinning all
-- four costs nothing and clears the advisor.
alter function public.prevent_audit_log_mutation() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.stamp_invitation_revocation() set search_path = public;
alter function public.ca_is_open(public.ca_status) set search_path = public;
