'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { useAuth } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Auth screens shell. Already-authenticated users are bounced to /dashboard.
 * Wrapped in an ErrorBoundary (RULE 8).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user !== null) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-md">
      <div className="w-full max-w-md">
        <div className="mb-lg flex flex-col items-center gap-sm">
          <ShieldCheck className="h-10 w-10 text-primary-500" aria-hidden />
          <h1 className="font-display text-2xl font-bold text-primary-800">
            {SoteriaStrings.common.appName}
          </h1>
        </div>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
