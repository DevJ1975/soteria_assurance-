'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';

/**
 * Redirects unauthenticated users to /login. While auth state is resolving it
 * renders a centered loader so protected screens never flash their contents to
 * a signed-out user.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-flex items-center gap-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          {SoteriaStrings.common.loading}
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
