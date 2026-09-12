/**
 * Supabase auth lifecycle and route-group redirects.
 *
 * Owns three things the rest of the app depends on: the session, the tenant
 * claims resolved from the signed-in user's profile, and the redirect between
 * the `(auth)` and `(app)` route groups.
 *
 * Claims come from the `profiles` row rather than the JWT. Supabase does not
 * mint the tenant custom claims Firebase did, and the profile is the thing RLS
 * itself reads — so this matches what the database will actually enforce
 * rather than a parallel copy that can go stale.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '@soteria/core';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

export interface AuthContextValue {
  session: Session | null;
  initializing: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  const setUser = useAuthStore((state) => state.setUser);
  const setClaims = useAuthStore((state) => state.setClaims);
  const setStoreInitializing = useAuthStore((state) => state.setInitializing);
  const reset = useAuthStore((state) => state.reset);

  // Session first, then updates. getSession() resolves from AsyncStorage, so a
  // returning auditor is signed in before the first render rather than being
  // bounced to the login screen and back.
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setInitializing(false);
      setStoreInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setInitializing(false);
      setStoreInitializing(false);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [setStoreInitializing]);

  // Mirror the session and its claims into the store the screens read.
  useEffect(() => {
    const user = session?.user;
    if (!user) {
      reset();
      return;
    }
    setUser({
      uid: user.id,
      email: user.email ?? null,
      displayName: (user.user_metadata?.display_name as string | undefined) ?? null,
      emailVerified: user.email_confirmed_at !== null && user.email_confirmed_at !== undefined,
    });

    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role, client_ids')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!profile) {
        // Authenticated but not yet assigned to an organization. Left null so
        // the screens show the pending state rather than an empty tenant.
        setClaims(null);
        return;
      }
      const { data: tenant } = await supabase
        .from('tenants')
        .select('type')
        .eq('id', profile.tenant_id)
        .maybeSingle();
      if (cancelled) return;
      setClaims({
        tenantId: profile.tenant_id,
        tenantType: tenant?.type === 'certification_body' ? 'cb' : (tenant?.type ?? 'enterprise'),
        role: profile.role as UserRole,
        permissions: [],
        clientIds: profile.client_ids ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session, setUser, setClaims, reset]);

  // Redirect only once auth has resolved, so the app never flashes the login
  // screen at someone who is already signed in.
  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) router.replace('/(auth)/login');
    else if (session && inAuthGroup) router.replace('/(app)/dashboard');
  }, [initializing, session, segments, router]);

  const value: AuthContextValue = {
    session,
    initializing,
    signInEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an <AuthProvider>.');
  return context;
}
