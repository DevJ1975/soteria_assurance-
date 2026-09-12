-- First-run onboarding.
--
-- A welcome screen has to know whether this is a first sign-in, and "have they
-- seen it" is per-person state that must survive logout, a new device and a
-- password reset — so it belongs on the profile, not in localStorage.
--
-- Null means "never completed". Existing users are backfilled as already
-- onboarded: they have been using the product, and showing them a welcome tour
-- because a column was added would be a bug, not a feature.
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

update public.profiles set onboarded_at = created_at where onboarded_at is null;

-- Records that the platform told a new company how to get started, so a resend
-- is a deliberate act rather than an accident of a retried request.
alter table public.tenants
  add column if not exists onboarding_email_sent_at timestamptz;

-- A user may mark their own onboarding complete. `users_can_update_own_profile`
-- already permits self-updates and pins role/tenant_id, so no new policy is
-- needed — this comment records that the column is deliberately self-writable.
comment on column public.profiles.onboarded_at is
  'When this user finished the first-run welcome. Null = never. Self-writable.';
