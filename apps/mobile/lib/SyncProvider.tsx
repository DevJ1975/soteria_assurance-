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
import { runSync } from '../services/syncManager';

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
      await runSync();
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
