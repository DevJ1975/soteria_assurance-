-- Metadata for generated audit report PDFs.
--
-- The PDF bytes live in the private `reports` storage bucket; this table is
-- the durable record of what was generated, when, by whom, and where — the
-- same audit-trail role audit_logs and ai_logs play for their own kind of
-- event. Without it, "who generated this report and when" only exists as an
-- object-store timestamp with no actor attached.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  audit_number text not null,
  format text not null default 'pdf',
  storage_path text not null,
  size_bytes bigint not null,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now()
);

create index reports_tenant_audit_idx on public.reports(tenant_id, audit_id, generated_at desc);

alter table public.reports enable row level security;

-- Readable so a tenant can see its own report history. No client write
-- policy at all: only the generate-report-pdf Edge Function's service-role
-- client inserts here, after it has already rendered and stored the PDF —
-- a client-writable metadata row with no matching object would be a report
-- link to nothing.
create policy tenant_members_can_read_reports on public.reports
  for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_super_admin());
