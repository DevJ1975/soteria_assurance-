-- Persists opening and closing audit meetings.
--
-- THE GAP THIS CLOSES
-- `packages/core/src/types/meeting.ts` fully specifies a Meeting — attendees
-- with presence flags and per-attendee signatures, an agenda with clause
-- references, minutes, decisions, action items, recording and transcription,
-- and `findingsSummaryPresented` — and NO TABLE EXISTED. Nothing persisted any
-- of it. The mobile meetings screen held its AI summary in React state, where
-- it was lost on navigation, and the only durable artefact was an audio blob
-- filed as generic evidence. There was no meetings screen on web at all.
--
-- ISO 19011:2018 requires an opening meeting (§6.4.3) and a closing meeting
-- (§6.4.10), and §6.6 requires records of them. For a certification audit,
-- attendance and the record that findings were presented and acknowledged at
-- the closing meeting are mandatory audit records. An accreditation body
-- reviewing this audit file previously found an audio file and no record that
-- an opening meeting took place, who attended it, or what was presented.

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,

  type text not null check (type in ('opening', 'closing')),
  scheduled_at timestamptz not null default now(),
  actual_start_at timestamptz,
  actual_end_at timestamptz,

  location text not null default '',
  is_virtual boolean not null default false,
  virtual_link text,

  -- Structured collections travel as jsonb rather than side tables: they are
  -- always read and written whole with their meeting, are never queried
  -- across meetings, and mirror the shapes already defined in
  -- packages/core/src/types/meeting.ts.
  attendees jsonb not null default '[]'::jsonb,
  agenda_items jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  signature_urls jsonb not null default '[]'::jsonb,
  key_decisions text[] not null default '{}',

  recording_url text,
  recording_duration integer,
  transcription text,
  ai_summary text,

  -- What was actually PRESENTED at the closing meeting, which is not
  -- necessarily what the findings say today. ISO 19011 6.4.10 wants the
  -- record of the presentation, so this is a snapshot, not a live join.
  findings_summary_presented jsonb,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'canceled')),
  notes text not null default '',

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One opening and one closing meeting per audit. A second "opening meeting"
-- is a correction to the first, not a new record.
create unique index if not exists meetings_audit_type_key
  on public.meetings (audit_id, type)
  where deleted_at is null;

create index if not exists meetings_tenant_active_idx
  on public.meetings (tenant_id) where deleted_at is null;

alter table public.meetings enable row level security;

-- Same shape as every other business table: read open to the tenant, write
-- gated on role. `auditee` is intentionally excluded from writing — the
-- meeting record is the audit team's record of what was presented, and the
-- audited party being able to edit it is exactly the problem that
-- 20260914010000 closed for findings.
create policy tenant_members_can_read_meetings on public.meetings
  for select using (tenant_id = public.current_tenant_id() and deleted_at is null);

create policy writers_can_insert_meetings on public.meetings
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(
      variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[]
    )
  );

create policy writers_can_update_meetings on public.meetings
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(
      variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[]
    )
  ) with check (
    tenant_id = public.current_tenant_id()
    and public.current_role_in(
      variadic array['super_admin','tenant_admin','lead_auditor','auditor']::public.user_role[]
    )
  );

-- No DELETE policy: meeting records are retained like every other audit
-- record. Disposition is the soft delete above.

grant select, insert, update on public.meetings to authenticated, service_role;

create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- Meetings join the append-only change log alongside the other core tables,
-- so who changed an attendance record and when is recoverable.
create trigger meetings_audit_log
  after insert or update or delete on public.meetings
  for each row execute function public.log_core_table_change();

comment on table public.meetings is
  'Opening and closing audit meetings (ISO 19011 6.4.3 / 6.4.10). Attendance '
  'and the record of findings presented at closing are mandatory audit records.';
