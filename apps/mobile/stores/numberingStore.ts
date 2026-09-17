/**
 * Offline-safe document numbering.
 *
 * WHY THIS EXISTS
 * Two auditors offline on the same audit each computed `findings.length + 1`
 * and minted the same finding number. The second push hit
 * UNIQUE (tenant_id, finding_number), was marked failed and retried forever —
 * a finding silently lost. The device had no way to ask the server's atomic
 * allocator while it had no signal.
 *
 * So it asks BEFORE it loses signal. Every sync pass reserves a block of
 * numbers per prefix from `reserve_document_seq_block`, which advances the
 * same tenant-locked sequence `next_document_seq` uses. Numbers in a block are
 * unique by construction. In the field the device draws from its block; when
 * the block runs dry with no signal it mints a device-scoped PROVISIONAL
 * number that cannot collide with any other device, and flags it.
 *
 * Persisted, because a block reserved this morning must survive the app
 * being killed at lunchtime.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/** How many numbers to hold per prefix. A day of fieldwork rarely exceeds 10. */
export const BLOCK_SIZE = 25;
/** Refill when fewer than this remain, so a long day never runs dry mid-way. */
const REFILL_BELOW = 8;

interface Block {
  next: number;
  end: number;
}

interface NumberingState {
  /** Stable per-install id, minted once. Provisional numbers carry it. */
  deviceTag: string;
  /** Keyed `${tenantId}:${prefix}:${year}`. */
  blocks: Record<string, Block>;
  /** Count of provisional numbers minted per key, for the local sequence. */
  provisional: Record<string, number>;

  take: (tenantId: string, prefix: string, year: number) => string;
  refill: (tenantId: string, prefixes: string[], year: number) => Promise<void>;
}

const key = (tenantId: string, prefix: string, year: number): string =>
  `${tenantId}:${prefix}:${year}`;

const pad = (n: number): string => String(n).padStart(4, '0');

function mintDeviceTag(): string {
  // Four base-36 characters from a random source: 1.6M values, which is
  // plenty to keep two devices on the same audit apart.
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export const useNumberingStore = create<NumberingState>()(
  persist(
    (set, get) => ({
      deviceTag: mintDeviceTag(),
      blocks: {},
      provisional: {},

      take: (tenantId, prefix, year) => {
        const k = key(tenantId, prefix, year);
        const block = get().blocks[k];
        if (block !== undefined && block.next <= block.end) {
          set((state) => ({
            blocks: { ...state.blocks, [k]: { ...block, next: block.next + 1 } },
          }));
          return `${prefix}-${year}-${pad(block.next)}`;
        }

        // Block exhausted and (presumably) offline. A provisional number:
        // device-scoped, so it cannot collide, and visibly marked so the lead
        // auditor can renumber it before the report is issued.
        const count = (get().provisional[k] ?? 0) + 1;
        set((state) => ({ provisional: { ...state.provisional, [k]: count } }));
        return `${prefix}-${year}-P${get().deviceTag}${String(count).padStart(2, '0')}`;
      },

      refill: async (tenantId, prefixes, year) => {
        for (const prefix of prefixes) {
          const k = key(tenantId, prefix, year);
          const block = get().blocks[k];
          const remaining = block === undefined ? 0 : Math.max(0, block.end - block.next + 1);
          if (remaining >= REFILL_BELOW) continue;

          const { data, error } = await supabase.rpc('reserve_document_seq_block', {
            p_tenant_id: tenantId,
            p_prefix: prefix,
            p_year: year,
            p_count: BLOCK_SIZE,
          });
          if (error || !Array.isArray(data) || data.length === 0) continue;
          const reserved = data[0] as { block_start: number; block_end: number };

          // A fresh block replaces the remainder rather than appending: the
          // old tail is abandoned as a harmless gap. Keeping a list of ranges
          // is not worth the complexity for a few unused numbers.
          set((state) => ({
            blocks: {
              ...state.blocks,
              [k]: { next: reserved.block_start, end: reserved.block_end },
            },
          }));
        }
      },
    }),
    {
      name: 'soteria-numbering',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
