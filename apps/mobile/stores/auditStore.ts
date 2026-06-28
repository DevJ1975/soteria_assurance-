/**
 * Audit Zustand store (DESIGN_DOC §5.6).
 *
 * The field-audit "working context": which audit is open, which clause the
 * auditor is currently assessing, the live sync indicator state (§11), and the
 * AI co-pilot drawer. WatermelonDB remains the source of truth for the audit
 * *data*; this store holds only ephemeral UI/session context plus a derived
 * mirror of the sync state.
 *
 * Persisted (AsyncStorage) so that re-opening the app after a crash mid-audit
 * restores the active audit + clause (RULE 8 recovery + §11 offline-first).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Header sync indicator state (§11 sync status indicator colors). */
export type SyncIndicator = 'synced' | 'pending' | 'failed' | 'offline' | 'syncing';

export interface AuditSessionState {
  /** Local WatermelonDB id of the audit currently being conducted. */
  activeAuditId: string | null;
  /** Clause number (e.g. "6.1.2") currently open in the clause navigator. */
  activeClauseNumber: string | null;

  // Sync indicator (§11) — derived from the sync manager + NetInfo.
  syncIndicator: SyncIndicator;
  /** Count of local records not yet pushed to Firestore. */
  pendingChanges: number;
  /** Epoch millis of the last successful full sync, or null if never. */
  lastSyncedAt: number | null;
  /** Human-readable detail for the "tap for details" failure affordance. */
  lastSyncError: string | null;

  // AI co-pilot drawer (§9.4).
  isCopilotOpen: boolean;

  // Actions
  setActiveAudit: (auditId: string | null) => void;
  setActiveClause: (clauseNumber: string | null) => void;
  setSyncIndicator: (indicator: SyncIndicator) => void;
  setPendingChanges: (count: number) => void;
  markSynced: (at: number) => void;
  setSyncError: (message: string | null) => void;
  openCopilot: () => void;
  closeCopilot: () => void;
  /** Clears the active session (e.g. on sign-out). */
  clearSession: () => void;
}

export const useAuditStore = create<AuditSessionState>()(
  persist(
    (set) => ({
      activeAuditId: null,
      activeClauseNumber: null,
      syncIndicator: 'offline',
      pendingChanges: 0,
      lastSyncedAt: null,
      lastSyncError: null,
      isCopilotOpen: false,

      setActiveAudit: (auditId): void =>
        set({ activeAuditId: auditId, activeClauseNumber: null }),
      setActiveClause: (clauseNumber): void => set({ activeClauseNumber: clauseNumber }),
      setSyncIndicator: (indicator): void => set({ syncIndicator: indicator }),
      setPendingChanges: (count): void =>
        set((state) => ({
          pendingChanges: count,
          // A nonzero queue while online surfaces as "pending"; zero as "synced"
          // unless we are explicitly offline/failed/syncing.
          syncIndicator:
            state.syncIndicator === 'offline' ||
            state.syncIndicator === 'failed' ||
            state.syncIndicator === 'syncing'
              ? state.syncIndicator
              : count > 0
                ? 'pending'
                : 'synced',
        })),
      markSynced: (at): void =>
        set({
          lastSyncedAt: at,
          pendingChanges: 0,
          syncIndicator: 'synced',
          lastSyncError: null,
        }),
      setSyncError: (message): void =>
        set({
          lastSyncError: message,
          syncIndicator: message === null ? 'synced' : 'failed',
        }),
      openCopilot: (): void => set({ isCopilotOpen: true }),
      closeCopilot: (): void => set({ isCopilotOpen: false }),
      clearSession: (): void =>
        set({
          activeAuditId: null,
          activeClauseNumber: null,
          isCopilotOpen: false,
          pendingChanges: 0,
          lastSyncError: null,
        }),
    }),
    {
      name: 'soteria-audit-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the durable session pointers; the live sync/UI flags
      // (`syncIndicator`, `isCopilotOpen`) are recomputed at start-up.
      partialize: (
        state: AuditSessionState,
      ): Pick<
        AuditSessionState,
        'activeAuditId' | 'activeClauseNumber' | 'lastSyncedAt' | 'pendingChanges'
      > => ({
        activeAuditId: state.activeAuditId,
        activeClauseNumber: state.activeClauseNumber,
        lastSyncedAt: state.lastSyncedAt,
        pendingChanges: state.pendingChanges,
      }),
    },
  ),
);
