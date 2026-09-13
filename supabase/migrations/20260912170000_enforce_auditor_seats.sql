-- Enforces tenants.max_auditors at invitation time.
--
-- The seat count has been visible in the superadmin console since the
-- oversight migration, and enforced nowhere: inviting a sixth auditor into a
-- five-seat tenant has always silently succeeded. This closes that gap for
-- the two roles the platform actually counts as auditor seats — lead_auditor
-- and auditor, matching tenant_usage.active_auditors exactly. tenant_admin
-- and viewer invitations are never gated; they are not auditor seats.
--
-- The check has to be atomic with the write, not a query before it. Reading
-- "seats used" and then inserting the invitation as two separate round trips
-- has the same race the document-numbering fix closed a few migrations back:
-- two admins inviting the last seat at once could both read "one free" and
-- both take it. A `select ... for update` on the tenant row serializes
-- concurrent invites for the same tenant, the same way next_document_seq's
-- upsert lock serializes concurrent number allocation.
create or replace function public.create_or_renew_invitation(
  p_tenant_id uuid,
  p_email text,
  p_display_name text,
  p_role public.user_role,
  p_invited_by uuid,
  p_expires_at timestamptz
)
returns public.auditor_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_roles constant public.user_role[] := array['lead_auditor', 'auditor']::public.user_role[];
  v_email constant text := lower(trim(p_email));
  v_max_auditors integer;
  v_reserved integer;
  v_row public.auditor_invitations;
begin
  select max_auditors into v_max_auditors
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'That organization does not exist.' using errcode = '02000';
  end if;

  if p_role = any(v_seat_roles) then
    -- Active members plus other still-live pending invitations at this tier.
    -- The invitation being written here is excluded from its own count: a
    -- resend or a role edit on an *existing* invitation must not be charged
    -- as a second seat on top of the one it already holds.
    select
      (select count(*) from public.profiles
        where tenant_id = p_tenant_id and is_active and role = any(v_seat_roles))
      + (select count(*) from public.auditor_invitations
          where tenant_id = p_tenant_id
            and status = 'pending'
            and expires_at > now()
            and role = any(v_seat_roles)
            and email <> v_email)
    into v_reserved;

    if v_reserved + 1 > v_max_auditors then
      raise exception 'This organization has used all % of its auditor seats.', v_max_auditors
        using errcode = 'SA001';
    end if;
  end if;

  -- Same upsert the Edge Function performed directly before this migration:
  -- (tenant_id, email) is unique, so a repeat invitation reopens the existing
  -- row and extends its expiry rather than failing the constraint.
  insert into public.auditor_invitations (
    tenant_id, email, display_name, role, status, invited_by, expires_at,
    accepted_at, accepted_by, revoked_at
  )
  values (
    p_tenant_id, v_email, p_display_name, p_role, 'pending', p_invited_by, p_expires_at,
    null, null, null
  )
  on conflict (tenant_id, email) do update
    set display_name = excluded.display_name,
        role = excluded.role,
        status = 'pending',
        invited_by = excluded.invited_by,
        expires_at = excluded.expires_at,
        accepted_at = null,
        accepted_by = null,
        revoked_at = null
  returning * into v_row;

  return v_row;
end;
$$;

-- Every new function in this schema is EXECUTE-granted, by default, through
-- TWO independent paths at once — confirmed on a from-scratch database by
-- comparing this function's just-created proacl against three sibling
-- functions with no explicit grant: all four showed both a bare `=X/postgres`
-- entry (PUBLIC) and separate named `anon=X/postgres` / `authenticated=
-- X/postgres` entries. Either path alone is sufficient to execute — Postgres
-- grants the privilege if ANY applicable entry allows it — so revoking only
-- one leaves the function fully reachable through the other. Proven the hard
-- way in two stages: `revoke ... from anon, authenticated` alone left the
-- PUBLIC entry standing and the anon key could still call this function
-- directly over PostgREST; `revoke ... from public` alone (on a freshly
-- recreated function) removed PUBLIC but left the named anon/authenticated
-- entries standing, same result. Both forms are required together.
--
-- This one is not meant to be reachable at all from an ordinary session: it
-- trusts p_invited_by and p_tenant_id without re-deriving them from the
-- caller's own session, because its only caller is the invite-auditor Edge
-- Function's service-role client, which has already verified who is asking
-- and which tenant they may act on.
revoke execute on function public.create_or_renew_invitation(uuid, text, text, public.user_role, uuid, timestamptz)
  from public, anon, authenticated;
