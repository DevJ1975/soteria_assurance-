'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';

/**
 * Entry route. Redirects to /dashboard when authenticated, otherwise /login.
 * Pure client-side (static export — no server redirects).
 */
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(user !== null ? '/dashboard' : '/login');
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="inline-flex items-center gap-sm text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        {SoteriaStrings.common.loading}
      </span>
    </div>
  );
}
