/**
 * Router root layout.
 *
 * Mounts every app-wide provider in the correct order:
 *   1. SafeAreaProvider     — inset context for all screens.
 *   2. PaperProvider        — RN-Paper theme derived from Soteria tokens.
 *   3. QueryClientProvider  — TanStack Query v5 for server-state (AI, pulls).
 *   4. DatabaseProvider     — WatermelonDB instance (offline source of truth).
 *   5. AuthProvider         — Firebase auth lifecycle + route-group redirects.
 *   6. SyncProvider         — connectivity-driven background sync (§11).
 *
 * The whole tree is wrapped in an {@link AuditErrorBoundary} so even a provider
 * failure shows the recovery UI rather than a white screen (RULE 8).
 */
import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { database } from '../db';
import { paperTheme } from '../theme/paper';
import { colors } from '../theme';
import { AuthProvider } from '../lib/AuthProvider';
import { SyncProvider } from '../lib/SyncProvider';
import { AuditErrorBoundary } from '../components/common/AuditErrorBoundary';

export default function RootLayout(): JSX.Element {
  // One QueryClient for the app's lifetime; defaults tuned for offline-first
  // (don't aggressively refetch — local DB is the source of truth).
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 60_000,
          },
        },
      }),
    [],
  );

  return (
    <AuditErrorBoundary screenName="root">
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <QueryClientProvider client={queryClient}>
            <DatabaseProvider database={database}>
              <AuthProvider>
                <SyncProvider>
                  <StatusBar style="light" backgroundColor={colors.primary[800]} />
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                  </Stack>
                </SyncProvider>
              </AuthProvider>
            </DatabaseProvider>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </AuditErrorBoundary>
  );
}
