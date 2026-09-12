'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { WelcomeScreen } from '@/components/WelcomeScreen';

/**
 * Redirects unauthenticated users to /login. While auth state is resolving it
 * renders a centered loader so protected screens never flash their contents to
 * a signed-out user.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuth();
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

  if (claims === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-md">
        <div className="max-w-md rounded-lg border border-border-soft bg-surface p-lg text-center shadow-card-soft">
          <h1 className="font-display text-lg font-semibold text-text-primary">
            Organization access pending
          </h1>
          <p className="mt-sm text-sm text-text-secondary">
            Your account is authenticated, but it has not been assigned to a Soteria organization.
            Ask a tenant administrator to complete your invitation.
          </p>
        </div>
      </div>
    );
  }

  // Shown once per person, after the profile resolves so the welcome can name
  // the organization and role they were given.
  if (claims.onboardedAt === null) {
    return <WelcomeScreen />;
  }

  return <>{children}</>;
}
