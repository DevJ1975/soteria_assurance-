-- Invitation-controlled onboarding, plus the columns the web and mobile
-- clients need to persist clause assessments and private evidence objects.

-- A clause assessment records when it was signed off, not just that it was.
-- The ISO 45001 report needs the completion time as part of the audit trail.
alter table public.clause_assessments
  add column if not exists completed_at timestamptz;

-- Evidence now lives in private buckets, so the durable reference is the
-- object path (`<tenant-id>/<audit-id>/<file>`), not a URL. `file_url` stays
-- for rows migrated from Firebase; new rows leave it empty and read through a
-- short-lived signed URL derived from `storage_path`.
alter table public.evidence
  add column if not exists storage_path text,
  add column if not exists thumbnail_path text,
  add column if not exists storage_bucket text not null default 'evidence';

alter table public.evidence
  alter column file_url set default '';

-- Invitations are the only path into a tenant. Track acceptance and
-- revocation explicitly so an accepted or revoked invitation can never be
-- replayed by a second sign-up with the same address.
alter table public.auditor_invitations
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_at timestamptz;

create index if not exists auditor_invitations_email_pending_idx
  on public.auditor_invitations(lower(email))
  where status = 'pending';

-- Provisioning runs in the database rather than in the client that accepts the
-- invitation: the new user has no profile yet, so it has no tenant to be
-- scoped to and could not write one under RLS. Running here also means the
-- profile exists before the first authenticated request is served.
create or replace function public.handle_invited_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.auditor_invitations%rowtype;
  invited_display_name text;
begin
  select * into invitation
  from public.auditor_invitations
  where lower(email) = lower(new.email)
    and status = 'pending'
    and expires_at > now()
  order by created_at desc
  limit 1;

  -- No pending invitation means no tenant assignment. The user is left
  -- without a profile and the app shows the organization-access-pending
  -- state; it must never fall back to a default tenant.
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
  where id = invitation.id;

  return new;
end;
$$;

-- Provisioning is keyed on the email being CONFIRMED, not on the user row
-- appearing. `inviteUserByEmail` inserts an unconfirmed user the moment the
-- invitation is sent; provisioning there would mark the invitation accepted by
-- someone who has not clicked the link yet. Two triggers are needed because a
-- combined INSERT OR UPDATE trigger cannot reference OLD in its WHEN clause.
drop trigger if exists on_auth_user_created_apply_invitation on auth.users;
create trigger on_auth_user_created_apply_invitation
  after insert on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.handle_invited_user();

drop trigger if exists on_auth_user_confirmed_apply_invitation on auth.users;
create trigger on_auth_user_confirmed_apply_invitation
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_invited_user();

-- Revocation must also close the door on an invitation email already in an
-- inbox: `handle_invited_user` only matches rows still in `pending`.
create or replace function public.stamp_invitation_revocation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'revoked' and old.status <> 'revoked' then
    new.revoked_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auditor_invitations_revocation on public.auditor_invitations;
create trigger auditor_invitations_revocation
  before update on public.auditor_invitations
  for each row execute function public.stamp_invitation_revocation();
