'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  confirmPhoneCode,
  createRecaptchaVerifier,
  getCurrentClaims,
  onAuthStateChangedTyped,
  registerWithEmail,
  signInWithEmail,
  signInWithGooglePopup,
  signOutUser,
  startPhoneSignIn,
  type ConfirmationResult,
  type FirebaseUser,
} from '@soteria/firebase';
import type { FirebaseCustomClaims } from '@soteria/core';

/**
 * Auth state + actions exposed to the web app. Every Firebase call is routed
 * through the `@soteria/firebase` helpers (RULE 3 / RULE 10) — the AuthProvider
 * never touches the SDK directly. `onAuthStateChanged` is the single source of
 * truth for `user`/`claims`, so the action wrappers just kick off the flow and
 * let the subscription drive any redirect.
 */
export interface AuthContextValue {
  /** Current Firebase user, or `null` when signed out. */
  user: FirebaseUser | null;
  /** Tenant-scoped custom claims, or `null` until provisioned server-side. */
  claims: FirebaseCustomClaims | null;
  /** `true` until the initial auth state (and its claims) have resolved. */
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  /**
   * Sends an SMS code to `phoneNumber`, mounting an invisible reCAPTCHA into the
   * element with id `recaptchaContainerId`. Returns the confirmation handle that
   * {@link AuthContextValue.confirmPhone} verifies.
   */
  startPhone: (phoneNumber: string, recaptchaContainerId: string) => Promise<ConfirmationResult>;
  confirmPhone: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [claims, setClaims] = useState<FirebaseCustomClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedTyped((nextUser) => {
      setUser(nextUser);
      if (nextUser === null) {
        setClaims(null);
        setLoading(false);
        return;
      }
      // Pull the tenant/role claims from the fresh ID token.
      void getCurrentClaims()
        .then(setClaims)
        .catch(() => setClaims(null))
        .finally(() => setLoading(false));
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      loading,
      signInEmail: async (email, password) => {
        await signInWithEmail(email, password);
      },
      registerEmail: async (email, password, displayName) => {
        await registerWithEmail(email, password, displayName);
      },
      signInGoogle: async () => {
        await signInWithGooglePopup();
      },
      startPhone: (phoneNumber, recaptchaContainerId) =>
        startPhoneSignIn(phoneNumber, createRecaptchaVerifier(recaptchaContainerId)),
      confirmPhone: async (confirmation, code) => {
        await confirmPhoneCode(confirmation, code);
      },
      signOut: async () => {
        await signOutUser();
      },
    }),
    [user, claims, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Throws if used outside an `<AuthProvider>`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return context;
}
