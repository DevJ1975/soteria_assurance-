-- Usage log for every AI co-pilot call.
--
-- Serves three purposes at once, which is why it is one table rather than
-- three: an audit trail of what the AI was asked and what it cost, the source
-- of truth for the per-tenant rate limit (counting rows in the window beats a
-- separate counter that can drift out of step with reality), and the basis for
-- per-tenant usage reporting.
--
-- Prompts and completions are deliberately NOT stored. An auditor's raw notes
-- are client-confidential and an NCR draft is unconfirmed text; keeping either
-- here would duplicate confidential content outside the records that own it,
-- with a different retention story. Token counts give the cost picture without
-- that exposure.
create table if not exists public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  -- 'draft-ncr', 'suggest-questions', 'analyze-evidence', 'summarize-meeting'
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  ok boolean not null default true,
  /** Safe-to-log error category, never the provider's raw payload. */
  error text,
  created_at timestamptz not null default now()
);

-- The rate-limit query is "count this tenant's rows since T", so the index
-- leads with tenant and orders by time.
create index if not exists ai_logs_tenant_created_idx
  on public.ai_logs(tenant_id, created_at desc);

alter table public.ai_logs enable row level security;

-- Readable so a tenant can see its own consumption; superadmins see the
-- platform. Writes have no policy at all: only the Edge Functions insert here,
-- through the service role, which bypasses RLS. Deny-by-default means a client
-- cannot forge or delete usage records.
drop policy if exists tenant_members_can_read_ai_logs on public.ai_logs;
create policy tenant_members_can_read_ai_logs on public.ai_logs
  for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- Per-tenant AI usage in the current rolling hour, for the rate limiter and
-- for showing a tenant how close to the cap it is.
create or replace function public.ai_usage_last_hour(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ai_logs
  where tenant_id = p_tenant_id
    and created_at > now() - interval '1 hour';
$$;
