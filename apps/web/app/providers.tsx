'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Client-side providers mounted once at the root: React Query (client-side
 * Firebase reads — RULE: static export, no server fetching) and the Auth
 * context. A single QueryClient instance is kept stable across renders.
 *
 * `AuthProvider` is wrapped in an `ErrorBoundary` here — NOT just inside the
 * per-segment layouts — because `AuthProvider` initialises Firebase on mount.
 * If the public Firebase config is missing from the build, that init throws,
 * and a boundary nested *below* AuthProvider (in the route layouts) cannot
 * catch a parent's error. Catching it here turns an opaque white-screen
 * ("a client-side exception has occurred") into a readable message.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>{children}</AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
