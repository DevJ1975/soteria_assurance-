-- Makes audit evidence and issued reports write-once in the object store, and
-- gives them a content digest so substitution is detectable.
--
-- THE BUG THIS CLOSES
-- Each of the four private buckets carried a `_tenant_update` and a
-- `_tenant_delete` policy whose only predicate was the tenant folder prefix.
-- Any tenant member could therefore overwrite or remove any object in their
-- tenant at any time — including an evidence photograph cited as objective
-- evidence for a Major NC, and an already-issued report PDF.
--
-- Nothing detected it. `public.evidence` recorded file_size, mime_type,
-- captured_at and captured_by_auditor_id but no digest, so the metadata
-- survived unchanged while the bytes were replaced — actively vouching for the
-- wrong file. The append-only audit_logs trigger is attached to eight Postgres
-- tables and cannot see storage.objects at all.
--
-- ISO 45001 §7.5.3 requires documented information to be protected from loss of
-- integrity; ISO 19011 §6.4.7 requires audit evidence to be verifiable. An
-- evidence chain is tamper-evident only when a change to the captured artefact
-- is detectable after the fact.

-- ---------------------------------------------------------------------------
-- 1. Evidence, signatures and reports become write-once
-- ---------------------------------------------------------------------------
-- Captured evidence and an issued report are records of a moment. There is no
-- legitimate "edit the photograph" operation: a re-shoot is a new capture with
-- its own timestamp and its own author, which INSERT already covers.
--
-- `corrective-action-evidence` is deliberately NOT included. That bucket holds
-- the auditee's in-progress submissions against an open corrective action,
-- which they legitimately revise before submitting.
do $$
declare
  bucket_name text;
begin
  foreach bucket_name in array array['evidence', 'signatures', 'reports']
  loop
    execute format('drop policy if exists %I on storage.objects', bucket_name || '_tenant_update');
    execute format('drop policy if exists %I on storage.objects', bucket_name || '_tenant_delete');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Content digests
-- ---------------------------------------------------------------------------
-- A SHA-256 recorded at upload lets a later reader prove the bytes it fetched
-- are the bytes the auditor captured. Nullable because rows written before this
-- migration have no digest and inventing one would be worse than admitting the
-- gap — `content_sha256 is null` is itself the honest answer to "can this be
-- verified?".
alter table public.evidence add column if not exists content_sha256 text;
alter table public.reports  add column if not exists content_sha256 text;

alter table public.evidence drop constraint if exists evidence_content_sha256_check;
alter table public.evidence add constraint evidence_content_sha256_check
  check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$');

alter table public.reports drop constraint if exists reports_content_sha256_check;
alter table public.reports add constraint reports_content_sha256_check
  check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$');

comment on column public.evidence.content_sha256 is
  'Lowercase hex SHA-256 of the uploaded bytes, recorded at capture. NULL means '
  'the row predates digest recording and its integrity cannot be demonstrated.';

comment on column public.reports.content_sha256 is
  'Lowercase hex SHA-256 of the generated PDF. Lets a reader prove the file '
  'they fetched is the file that was issued.';

-- A digest that can be rewritten proves nothing. Once set it is immutable;
-- clearing or changing it is rejected.
create or replace function public.reject_digest_change()
returns trigger
language plpgsql
as $$
begin
  if old.content_sha256 is not null
     and new.content_sha256 is distinct from old.content_sha256 then
    raise exception
      'content_sha256 is immutable once recorded (%). A different file is a new record.',
      tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_digest_immutable on public.evidence;
create trigger evidence_digest_immutable
  before update on public.evidence
  for each row execute function public.reject_digest_change();

drop trigger if exists reports_digest_immutable on public.reports;
create trigger reports_digest_immutable
  before update on public.reports
  for each row execute function public.reject_digest_change();

-- ---------------------------------------------------------------------------
-- 3. Evidence rows are append-mostly too
-- ---------------------------------------------------------------------------
-- Verification (`is_verified`, `verified_by_auditor_id`) and soft deletion are
-- legitimate later writes. Rewriting who captured what, when, or which file it
-- points at is not.
create or replace function public.reject_evidence_provenance_change()
returns trigger
language plpgsql
as $$
begin
  if new.file_url             is distinct from old.file_url
     or new.captured_at       is distinct from old.captured_at
     or new.captured_by_auditor_id is distinct from old.captured_by_auditor_id
     or new.audit_id          is distinct from old.audit_id then
    raise exception
      'Evidence provenance (file, capture time, capturing auditor, audit) is immutable.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_provenance_immutable on public.evidence;
create trigger evidence_provenance_immutable
  before update on public.evidence
  for each row execute function public.reject_evidence_provenance_change();
