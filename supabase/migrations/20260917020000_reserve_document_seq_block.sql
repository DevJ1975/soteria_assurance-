-- Reserves a contiguous block of document numbers for one device to consume
-- offline.
--
-- THE BUG THIS CLOSES
-- Two auditors working offline on the same audit each computed
-- `findings.length + 1` as their next finding number. Both minted the same
-- number; the second push violated UNIQUE (tenant_id, finding_number), was
-- marked failed by the sync manager, and retried forever — permanent, silent
-- loss of a finding. The mobile code's own comment acknowledged the collision
-- and then implemented the colliding fallback anyway, because a device with no
-- signal cannot ask the allocator.
--
-- THE FIX
-- Ask BEFORE going offline. While a device has connectivity it reserves a
-- block (e.g. 25 numbers) per prefix from the same atomic, tenant-locked
-- allocator that `next_document_seq` uses, and draws from it in the field.
-- Numbers in a block are unique by construction because the block itself was
-- allocated under the row lock. A block the device never uses is simply a gap
-- in the sequence, which is harmless — document numbers must be unique, not
-- dense.
create or replace function public.reserve_document_seq_block(
  p_tenant_id uuid,
  p_prefix text,
  p_year integer,
  p_count integer
)
returns table (block_start integer, block_end integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_next integer;
begin
  if p_tenant_id is null or (p_tenant_id <> public.current_tenant_id() and not public.is_super_admin()) then
    raise exception 'You may only allocate document numbers for your own organization.'
      using errcode = 'insufficient_privilege';
  end if;
  -- Bounded, so a client bug cannot burn the sequence space.
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'Block size must be between 1 and 100.' using errcode = 'check_violation';
  end if;

  insert into public.document_sequences (tenant_id, prefix, year, next_seq)
  values (p_tenant_id, p_prefix, p_year, 1 + p_count)
  on conflict (tenant_id, prefix, year)
  do update set next_seq = public.document_sequences.next_seq + p_count
  returning public.document_sequences.next_seq - p_count into v_next;

  block_start := v_next;
  block_end := v_next + p_count - 1;
  return next;
end;
$$;

revoke execute on function public.reserve_document_seq_block(uuid, text, integer, integer) from public;
grant execute on function public.reserve_document_seq_block(uuid, text, integer, integer) to authenticated;

comment on function public.reserve_document_seq_block(uuid, text, integer, integer) is
  'Atomically reserves [block_start, block_end] for offline use. Same lock and '
  'sequence as next_document_seq, so numbers from a block never collide with '
  'numbers allocated singly.';
