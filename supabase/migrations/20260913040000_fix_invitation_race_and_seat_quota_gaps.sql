-- Two atomicity gaps and one missing enforcement, all found live:
--
-- 1. handle_invited_user() could have a just-revoked invitation silently
--    un-revoked by a concurrent signup confirmation.
-- 2. setUserRole() (the superadmin Users panel's role dropdown) writes
--    profiles.role directly with no seat check at all, completely bypassing
--    the max_auditors enforcement invitations go through.
-- 3. tenants.max_audits_per_month has been visible in the superadmin console
--    since the oversight migration and enforced nowhere — a tenant can
--    create an unlimited number of audits regardless of its plan.

-- 1. Lock the invitation row for the duration of this trigger's transaction,
--    and re-check status = 'pending' in the closing UPDATE rather than
--    writing unconditionally. A revoke that commits before this trigger's
--    SELECT now correctly finds no pending invitation and grants no access;
--    a revoke that is still queued behind this trigger's lock still applies
--    afterward (to a row this trigger has already marked accepted), so the
--    revocation is never silently erased the way it was before — the
--    ordering of two genuinely concurrent actions is decided by lock order,
--    not always overwritten in the accept's favor.
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

-- 2. Any write that puts a profile into a seat role (lead_auditor/auditor)
--    while active now re-runs the same check create_or_renew_invitation does
--    at invite time — closing the gap where promoting an existing member
--    from the Users panel bypassed it entirely. Moving between the two seat
--    roles, or any other column change, isn't a new claim on a seat and
--    isn't gated.
create or replace function public.enforce_auditor_seat_on_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_roles constant public.user_role[] := array['lead_auditor', 'auditor']::public.user_role[];
  v_max_auditors integer;
  v_used integer;
begin
  if not (new.role = any(v_seat_roles) and new.is_active) then
    return new;
  end if;
  if TG_OP = 'UPDATE' and old.role = any(v_seat_roles) and old.is_active and old.tenant_id = new.tenant_id then
    return new;
  end if;

  select max_auditors into v_max_auditors
  from public.tenants
  where id = new.tenant_id
  for update;

  if not found then
    raise exception 'That organization does not exist.' using errcode = '02000';
  end if;

  select count(*) into v_used
  from public.profiles
  where tenant_id = new.tenant_id
    and is_active
    and role = any(v_seat_roles)
    and id <> new.id;

  if v_used + 1 > v_max_auditors then
    raise exception 'This organization has used all % of its auditor seats.', v_max_auditors
      using errcode = 'SA001';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_auditor_seat on public.profiles;
create trigger profiles_enforce_auditor_seat
  before insert or update of role, is_active, tenant_id on public.profiles
  for each row execute function public.enforce_auditor_seat_on_profile_write();

-- 3. Same shape, for audits against tenants.max_audits_per_month. Counted by
--    creation month (calendar month of created_at at insert time), matching
--    ordinary billing-usage semantics; no existing view or code committed to
--    a different definition.
create or replace function public.enforce_audits_per_month_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_period_start timestamptz := date_trunc('month', now());
begin
  select max_audits_per_month into v_limit
  from public.tenants
  where id = new.tenant_id
  for update;

  if not found then
    raise exception 'That organization does not exist.' using errcode = '02000';
  end if;

  select count(*) into v_used
  from public.audits
  where tenant_id = new.tenant_id
    and created_at >= v_period_start;

  if v_used + 1 > v_limit then
    raise exception 'This organization has used all % of its audits for this month.', v_limit
      using errcode = 'SA002';
  end if;

  return new;
end;
$$;

drop trigger if exists audits_enforce_monthly_limit on public.audits;
create trigger audits_enforce_monthly_limit
  before insert on public.audits
  for each row execute function public.enforce_audits_per_month_limit();
