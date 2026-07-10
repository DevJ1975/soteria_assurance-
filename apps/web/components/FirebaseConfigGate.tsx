'use client';

import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FirebaseConfigNotice } from '@/components/FirebaseConfigNotice';

/**
 * Renders a setup screen instead of the app when the public Firebase config is
 * missing. Sits just inside `AuthProvider` so every route degrades to the same
 * actionable message rather than white-screening on a missing env var.
 */
export function FirebaseConfigGate({ children }: { children: ReactNode }) {
  const { firebaseConfig } = useAuth();
  if (!firebaseConfig.configured) {
    return <FirebaseConfigNotice missing={firebaseConfig.missing} />;
  }
  return <>{children}</>;
}
