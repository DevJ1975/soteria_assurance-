/**
 * Auth Zustand store.
 *
 * Holds the current Firebase user (id/email/displayName) plus the parsed
 * tenant-scoping {@link FirebaseCustomClaims}. The actual auth lifecycle is
 * driven by `@soteria/firebase` (`onAuthStateChangedTyped` + `getCurrentClaims`)
 * inside the `AuthProvider`; this store is the single read surface the UI uses
 * to know "who am I, which tenant, what role".
 *
 * The `tenantId` here is the one thing the offline DB and sync manager need to
 * scope every local write (RULE 2 mirror) — so it is also mirrored to
 * AsyncStorage via `persist` to survive cold starts while offline.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseCustomClaims, UserRole } from '@soteria/core';

/** Minimal, serialisable view of the signed-in Firebase user. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

export interface AuthState {
  /** `true` until the first `onAuthStateChanged` callback fires. */
  initializing: boolean;
  user: AuthUser | null;
  claims: FirebaseCustomClaims | null;

  setInitializing: (value: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  setClaims: (claims: FirebaseCustomClaims | null) => void;
  /** Clears all auth state (on sign-out). */
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      initializing: true,
      user: null,
      claims: null,
      setInitializing: (value): void => set({ initializing: value }),
      setUser: (user): void => set({ user }),
      setClaims: (claims): void => set({ claims }),
      reset: (): void => set({ user: null, claims: null }),
    }),
    {
      name: 'soteria-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the tenant-scoping claims + lightweight user so the app can
      // resolve `tenantId` offline on cold start; `initializing` is transient.
      partialize: (state: AuthState): Pick<AuthState, 'user' | 'claims'> => ({
        user: state.user,
        claims: state.claims,
      }),
    },
  ),
);

/** Convenience selectors. */
export const selectTenantId = (state: AuthState): string | null =>
  state.claims?.tenantId ?? null;

export const selectRole = (state: AuthState): UserRole | null =>
  state.claims?.role ?? null;

export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.user !== null;
