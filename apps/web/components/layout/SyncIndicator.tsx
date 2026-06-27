'use client';

import { useEffect, useState } from 'react';
import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { cn } from '@/lib/cn';

type SyncState = 'synced' | 'syncing' | 'offline';

/**
 * Topbar sync/status pill. The web app reads live from Firestore, so "sync"
 * here reflects network reachability (the offline-first WatermelonDB queue is a
 * mobile concern, RULE 9). Mirrors the mobile status vocabulary via
 * SoteriaStrings so copy stays consistent (RULE 4).
 */
export function SyncIndicator() {
  const [state, setState] = useState<SyncState>('synced');

  useEffect(() => {
    const update = () => setState(navigator.onLine ? 'synced' : 'offline');
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const label =
    state === 'offline'
      ? SoteriaStrings.common.offline
      : state === 'syncing'
        ? SoteriaStrings.common.syncing
        : SoteriaStrings.common.synced;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-sm py-1 text-xs font-medium',
        state === 'offline'
          ? 'border-warning/30 bg-warning/10 text-warning'
          : 'border-conforming/30 bg-conforming/10 text-conforming',
      )}
    >
      {state === 'offline' ? (
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
      ) : state === 'syncing' ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Check className="h-3.5 w-3.5" aria-hidden />
      )}
      {label}
    </span>
  );
}
