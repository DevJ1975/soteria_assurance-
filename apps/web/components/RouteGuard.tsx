'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';

/** How often the provisioning screen re-checks for freshly-minted claims. */
const CLAIMS_POLL_INTERVAL_MS = 10_000;

/**
 * Shown when the user is signed in but has no tenant claims yet — i.e. an
 * admin has not run `setTenantClaims` (or the bootstrap script) for them.
 * Without this, every dashboard screen silently rendered empty because all
 * queries are tenant-scoped. Polls for claims so provisioning takes effect
 * without a manual sign-out/sign-in.
 */
function AwaitingProvisioning() {
  const { refreshClaims, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshClaims();
    }, CLAIMS_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshClaims]);

  const handleRecheck = async () => {
    setChecking(true);
    try {
      await refreshClaims();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-md bg-background p-xl text-center">
      <ShieldAlert className="h-10 w-10 text-gold-500" aria-hidden />
      <h1 className="font-display text-xl font-semibold text-text-primary">
        {SoteriaStrings.setup.provisioningTitle}
      </h1>
      <p className="max-w-md text-sm text-text-secondary">
        {SoteriaStrings.setup.provisioningBody}
      </p>
      <div className="flex items-center gap-sm">
        <Button variant="outline" onClick={() => void handleRecheck()} disabled={checking}>
          {checking
            ? SoteriaStrings.setup.provisioningChecking
            : SoteriaStrings.setup.provisioningRecheck}
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          {SoteriaStrings.auth.signOutButton}
        </Button>
      </div>
    </div>
  );
}

/**
 * Redirects unauthenticated users to /login. While auth state is resolving it
 * renders a centered loader so protected screens never flash their contents to
 * a signed-out user. Signed-in users without tenant claims get the awaiting-
 * provisioning screen instead of an empty dashboard.
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
    return <AwaitingProvisioning />;
  }

  return <>{children}</>;
}
