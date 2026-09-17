/**
 * Connectivity-driven background sync.
 *
 * Sync is triggered by the network coming back rather than by a timer: a field
 * audit is mostly offline, and polling on a schedule would either waste
 * battery while there is no signal or leave work unsynced for a whole
 * interval after signal returns.
 *
 * Runs are serialised through a ref. Two overlapping pushes of the same local
 * records would race on their remote ids, and NetInfo can report reconnection
 * more than once as an interface settles.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../stores/authStore';
import { pullAudits, runSync } from '../services/syncManager';
import { retryPendingUploads } from '../services/evidenceService';
import { useNumberingStore } from '../stores/numberingStore';
import { FINDING_TYPE_META } from '@soteria/core';

/** Every finding-number prefix a device might need in the field. */
const FINDING_PREFIXES = Object.values(FINDING_TYPE_META).map((meta) => meta.code);

export interface SyncContextValue {
  /** True while a sync run is in flight. */
  syncing: boolean;
  /** When the last successful run finished, or null if none has. */
  lastSyncedAt: Date | null;
  /** Whether the device currently has a usable connection. */
  online: boolean;
  /** Requests a run now; a no-op while one is already running or offline. */
  syncNow: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const running = useRef(false);
  const tenantId = useAuthStore((state) => state.claims?.tenantId ?? '');

  async function sync(currentTenantId: string): Promise<void> {
    // No tenant means claims have not resolved yet; there is nothing scoped to
    // push and runSync would have no tenant to write against.
    if (running.current || currentTenantId === '') return;
    running.current = true;
    setSyncing(true);
    try {
      // PUSH FIRST, then pull. Local work is the thing that must not be lost,
      // and pullAudits skips any row still pending push — pushing first means
      // fewer rows it has to skip.
      await runSync();

      // Retry evidence whose binary upload failed while offline. Without this
      // call, `retryPendingUploads` was dead code: an upload attempted with no
      // signal landed in 'failed', `pushEvidence` only pushes rows marked
      // 'uploaded', and nothing ever re-attempted it. Photographs taken on a
      // site with no signal — the primary use case for an offline-first field
      // app — never reached the audit record.
      await retryPendingUploads();

      // PULL. Without this, nothing ever wrote an audit into the device
      // database: `pullAudits` was exported and called from nowhere, so the
      // mobile audit list was permanently empty and every screen behind it —
      // clauses, findings, evidence, meetings, report — was unreachable.
      await pullAudits(currentTenantId);

      // Top up the reserved finding-number blocks while we know we are online.
      // This is what lets the field screen mint collision-free numbers with
      // no signal — see stores/numberingStore.ts.
      await useNumberingStore
        .getState()
        .refill(currentTenantId, FINDING_PREFIXES, new Date().getFullYear());

      setLastSyncedAt(new Date());
    } catch (error) {
      // A failed sync is expected on a flaky connection; the records stay
      // pending locally and the next reconnection retries them.
      console.warn('[sync] run failed', error);
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }

  // On sign-in. NetInfo only fires on a CHANGE, so an app opened with a
  // working connection would otherwise never sync until the network dropped
  // and came back.
  useEffect(() => {
    void sync(tenantId);
    // `sync` is intentionally not a dependency: it is redefined every render
    // and including it would re-run this on every render, not on sign-in.
  }, [tenantId]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const reachable = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(reachable);
      if (reachable) void sync(tenantId);
    });
    return () => unsubscribe();
  }, [tenantId]);

  const value: SyncContextValue = {
    syncing,
    lastSyncedAt,
    online,
    syncNow: () => void sync(tenantId),
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a <SyncProvider>.');
  return context;
}
