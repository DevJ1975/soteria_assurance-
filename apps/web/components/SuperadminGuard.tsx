'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function SuperadminGuard({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user === null) router.replace('/superadmin/login');
    if (!loading && user !== null && claims !== null && claims.role !== 'super_admin') {
      router.replace('/dashboard');
    }
  }, [claims, loading, router, user]);

  if (loading || user === null || claims === null || claims.role !== 'super_admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="inline-flex items-center gap-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading administration…
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
