-- Semantic search over the clause corpus, on pgvector.
--
-- WHY THIS IS WORTH HAVING HERE
-- An auditor in the field does not think in clause numbers. They observe
-- something — "the contractor induction records stop after 2024" — and have to
-- decide which requirement it bears on. Today the only way to get from that to
-- a clause is the wiki's substring filter (apps/web/app/(dashboard)/wiki), which
-- matches "induction" only if a clause happens to contain that word. It does
-- not: the relevant ISO 45001 clauses talk about "competence", "awareness" and
-- "control of outsourced processes".
--
-- Substring search fails exactly where an auditor needs help most — when they
-- cannot name the requirement. Vector search answers by meaning instead.
--
-- Embeddings come from Supabase's own Edge Function inference (`gte-small`,
-- 384 dimensions), not a third-party embedding API: it runs inside the Edge
-- Runtime, needs no key, and nothing about the clause corpus or an auditor's
-- query leaves the project. Anthropic serves the reasoning models this product
-- already uses but does not offer embeddings, so this is the natural fit.

create table if not exists public.clause_embeddings (
  standard_id   text not null references public.standards(id) on delete cascade,
  clause_number text not null,
  clause_title  text not null,
  -- The text that was embedded, kept so a re-index can tell whether the source
  -- actually changed, and so a result can be shown without a second lookup
  -- into the @soteria/core dataset.
  content       text not null,
  embedding     extensions.vector(384),
  updated_at    timestamptz not null default now(),
  primary key (standard_id, clause_number)
);

comment on table public.clause_embeddings is
  'Vector index of the clause corpus in @soteria/core. Derived data: rebuilt by the index-clauses Edge Function, never authored here.';

-- HNSW rather than IVFFlat: the corpus is small (56 clauses for ISO 45001) and
-- essentially static, so build cost is irrelevant and HNSW does not need a
-- training set or a probe-count tuned to row count the way IVFFlat does.
-- Cosine distance, matching how gte-small embeddings are normally compared.
create index if not exists clause_embeddings_embedding_idx
  on public.clause_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.clause_embeddings enable row level security;

-- Reference data, like public.standards: the clause corpus is the published
-- standard as paraphrased in @soteria/core, identical for every tenant and
-- carrying nothing tenant-owned. Readable by any authenticated user.
--
-- No write policy at all. The only writer is the index-clauses Edge Function
-- through the service role, which bypasses RLS — deny-by-default means a client
-- cannot poison the index, which for a search that steers an auditor toward a
-- requirement would be a quiet way to steer them away from one.
drop policy if exists authenticated_can_read_clause_embeddings on public.clause_embeddings;
create policy authenticated_can_read_clause_embeddings
  on public.clause_embeddings
  for select to authenticated
  using (true);

/**
 * Returns the clauses closest in meaning to an embedded query.
 *
 * SECURITY INVOKER so the read still passes the policy above rather than
 * quietly bypassing it — there is no reason for this to be definer, and a
 * definer search function is how a "reference data only" table becomes a
 * general-purpose reader later.
 *
 * `p_standard_id` is required, not defaulted: "6.1.2" exists in every Annex SL
 * standard, and a search that silently spanned all of them would return the
 * environmental clause to an OH&S auditor.
 */
create or replace function public.match_clauses(
  p_standard_id     text,
  p_query_embedding extensions.vector(384),
  p_match_count     integer default 8,
  p_min_similarity  double precision default 0.3
)
returns table (
  clause_number text,
  clause_title  text,
  content       text,
  similarity    double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    ce.clause_number,
    ce.clause_title,
    ce.content,
    1 - (ce.embedding <=> p_query_embedding) as similarity
  from public.clause_embeddings ce
  where ce.standard_id = p_standard_id
    and ce.embedding is not null
    and 1 - (ce.embedding <=> p_query_embedding) > p_min_similarity
  -- Ordered by raw distance rather than the similarity expression so the HNSW
  -- index is actually used; ordering by `1 - (...)` defeats it.
  order by ce.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 25);
$$;

revoke execute on function public.match_clauses(text, extensions.vector, integer, double precision)
  from public, anon;
grant execute on function public.match_clauses(text, extensions.vector, integer, double precision)
  to authenticated;
