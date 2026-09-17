'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

export interface TenantClaims {
  tenantId: string;
  tenantType: 'cb' | 'consultancy' | 'enterprise';
  role: 'super_admin' | 'tenant_admin' | 'lead_auditor' | 'auditor' | 'auditee' | 'viewer';
  permissions: string[];
  clientIds?: string[];
  /** Company name, for the first-run welcome. */
  tenantName: string;
  /** When this user finished the welcome. Null = never, so show it. */
  onboardedAt: string | null;
}

export interface PhoneConfirmation {
  phone: string;
}

/**
 * Normalises a typed number to the digits-only E.164 form GoTrue stores.
 *
 * Users type `+1 (415) 555-0123`; GoTrue keys on `14155550123`. Without this,
 * the same number entered two different ways is two different accounts to the
 * OTP lookup, and sign-in fails for a number that is demonstrably on file.
 */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

export interface AuthContextValue {
  user: User | null;
  claims: TenantClaims | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, displayName: string) => Promise<void>;
  /**
   * Sends a sign-in code to a number already attached to an account.
   *
   * `[auth.sms] enable_signup` is false, so an unrecognised number is rejected
   * rather than silently creating an account that no invitation could ever
   * match. Attaching a number is {@link startPhoneEnrollment}, which requires
   * an authenticated session.
   */
  startPhone: (phoneNumber: string) => Promise<PhoneConfirmation>;
  confirmPhone: (confirmation: PhoneConfirmation, code: string) => Promise<void>;
  /** Attaches a phone number to the signed-in account and texts a code to it. */
  startPhoneEnrollment: (phoneNumber: string) => Promise<PhoneConfirmation>;
  /** Verifies the enrolment code, completing the attachment. */
  confirmPhoneEnrollment: (
    confirmation: PhoneConfirmation,
    code: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  /** Marks the first-run welcome complete and updates claims in place. */
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<TenantClaims | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      setClaims(null);
      setClaimsLoading(false);
      return;
    }
    let cancelled = false;
    setClaimsLoading(true);
    void (async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id, role, onboarded_at')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        if (!cancelled) {
          setClaims(null);
          setClaimsLoading(false);
        }
        return;
      }
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('type, name')
        .eq('id', profile.tenant_id)
        .maybeSingle();
      if (tenantError) throw tenantError;
      if (!cancelled) {
        setClaims({
          tenantId: profile.tenant_id,
          tenantType: tenant?.type === 'certification_body' ? 'cb' : tenant?.type ?? 'enterprise',
          role: profile.role,
          permissions: [],
          tenantName: tenant?.name ?? '',
          onboardedAt: profile.onboarded_at,
        });
        setClaimsLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setClaims(null);
        setClaimsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      loading: authLoading || claimsLoading,
      signInEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      registerEmail: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      },
      startPhone: async (phoneNumber) => {
        const phone = normalizePhone(phoneNumber);
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          // Belt and braces with the project setting: even if SMS signup were
          // turned on later, this call must never mint an account.
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        return { phone };
      },
      confirmPhone: async ({ phone }, token) => {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        if (error) throw error;
      },
      startPhoneEnrollment: async (phoneNumber) => {
        const phone = normalizePhone(phoneNumber);
        // updateUser is the enrolment path rather than signInWithOtp: it
        // attaches the number to the CURRENT account and texts a code to prove
        // the person asking actually holds it.
        const { error } = await supabase.auth.updateUser({ phone });
        if (error) throw error;
        return { phone };
      },
      confirmPhoneEnrollment: async ({ phone }, token) => {
        const { error } = await supabase.auth.verifyOtp({
          phone,
          token,
          // 'phone_change' is the type GoTrue issues for updateUser({ phone }).
          // Verifying it as 'sms' fails with an opaque "Token has expired or is
          // invalid", which is the wrong diagnosis entirely.
          type: 'phone_change',
        });
        if (error) throw error;
      },
      completeOnboarding: async () => {
        if (!user) return;
        const stamp = new Date().toISOString();
        const { error } = await supabase
          .from('profiles')
          .update({ onboarded_at: stamp })
          .eq('id', user.id);
        if (error) throw error;
        // Updated locally too, so the welcome screen closes immediately rather
        // than waiting for the claims effect to re-run.
        setClaims((current) => (current ? { ...current, onboardedAt: stamp } : current));
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [authLoading, claims, claimsLoading, supabase, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an <AuthProvider>.');
  return context;
}
