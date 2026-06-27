/**
 * Authentication service wrapping the modular Firebase Auth SDK.
 *
 * Supports all three providers required by the MONOREPO CONTRACT:
 *   - Email / Password
 *   - Google (popup on web; native/Expo credential flow on mobile)
 *   - Phone (invisible reCAPTCHA on web)
 *
 * Tenant isolation (SOTERIA RULE 2) is enforced via Firebase custom claims;
 * helpers here parse the claims off the ID token so callers always know the
 * acting user's tenant and role.
 *
 * @packageDocumentation
 */

import type { FirebaseCustomClaims, UserRole } from '@soteria/core';
import {
  type Auth,
  type ConfirmationResult,
  type User as FirebaseUser,
  GoogleAuthProvider,
  type IdTokenResult,
  RecaptchaVerifier,
  type Unsubscribe,
  type UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth } from './config';

// ---------------------------------------------------------------------------
// Email / Password
// ---------------------------------------------------------------------------

/**
 * Registers a new user with email + password and sets their display name.
 * A verification email is sent immediately after account creation.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await sendEmailVerification(credential.user);
  return credential;
}

/** Signs a user in with email + password. */
export function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

/**
 * Sends a verification email to the currently signed-in user.
 *
 * @throws {Error} when no user is signed in.
 */
export function sendVerificationEmail(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (user === null) {
    throw new Error('Cannot send verification email: no user is signed in.');
  }
  return sendEmailVerification(user);
}

/** Sends a password-reset email to the given address. */
export function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/**
 * Returns a configured {@link GoogleAuthProvider}.
 *
 * On web this is passed to {@link signInWithGooglePopup}. On mobile the
 * provider itself is not used for the interactive flow (Expo uses a native
 * Google sign-in module); instead the resulting idToken/accessToken are
 * exchanged via {@link signInWithGoogleCredential}.
 */
export function getGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  return provider;
}

/**
 * Web-only: opens the Google sign-in popup.
 *
 * NOTE: Mobile (Expo/React Native) must NOT call this — popups are not
 * available there. Mobile performs the Google flow natively (e.g.
 * `expo-auth-session` / `@react-native-google-signin`) and then calls
 * {@link signInWithGoogleCredential} with the tokens it obtains.
 */
export function signInWithGooglePopup(): Promise<UserCredential> {
  return signInWithPopup(getFirebaseAuth(), getGoogleProvider());
}

/**
 * Exchanges a Google `idToken` (and optional `accessToken`) obtained from a
 * native mobile sign-in flow for a Firebase {@link UserCredential}.
 *
 * This is the mobile/React Native counterpart to
 * {@link signInWithGooglePopup}.
 */
export function signInWithGoogleCredential(
  idToken: string,
  accessToken?: string,
): Promise<UserCredential> {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  return signInWithCredential(getFirebaseAuth(), credential);
}

// ---------------------------------------------------------------------------
// Phone (web)
// ---------------------------------------------------------------------------

/**
 * Creates an invisible {@link RecaptchaVerifier} bound to a DOM container.
 *
 * Web-only: the reCAPTCHA verifier requires a DOM and is not used on mobile
 * (Expo uses its own phone-auth flow). `containerId` is the id of an element
 * present in the page (e.g. an empty `<div id="recaptcha-container" />`).
 */
export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  return new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: 'invisible' });
}

/**
 * Begins a phone-number sign-in, sending an SMS code. The returned
 * {@link ConfirmationResult} is later passed to {@link confirmPhoneCode}.
 *
 * @param phoneNumber E.164 formatted number, e.g. `+14155550123`.
 * @param verifier    A verifier from {@link createRecaptchaVerifier} (web).
 */
export function startPhoneSignIn(
  phoneNumber: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, verifier);
}

/** Confirms a phone sign-in by verifying the SMS code the user received. */
export function confirmPhoneCode(
  confirmationResult: ConfirmationResult,
  code: string,
): Promise<UserCredential> {
  return confirmationResult.confirm(code);
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Signs the current user out. */
export function signOutUser(): Promise<void> {
  return signOut(getFirebaseAuth());
}

/**
 * Subscribes to auth-state changes with a strongly-typed callback.
 *
 * @returns an unsubscribe function.
 */
export function onAuthStateChangedTyped(
  callback: (user: FirebaseUser | null) => void,
): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

/**
 * Narrows the unknown `claims` bag from an ID token into the subset of
 * {@link FirebaseCustomClaims} fields we set server-side. Returns `null` when
 * the mandatory `tenantId`/`role` claims are absent (e.g. a freshly-created
 * account before claims have been provisioned).
 */
function parseCustomClaims(claims: IdTokenResult['claims']): FirebaseCustomClaims | null {
  const tenantId = claims['tenantId'];
  const tenantType = claims['tenantType'];
  const role = claims['role'];
  const permissions = claims['permissions'];
  const clientIds = claims['clientIds'];

  if (typeof tenantId !== 'string' || typeof role !== 'string') {
    return null;
  }

  const parsed: FirebaseCustomClaims = {
    tenantId,
    // The claim is provisioned server-side as one of these literals; we cast
    // the validated string to the narrow union after the runtime guards above.
    tenantType: (tenantType === 'cb' || tenantType === 'consultancy' || tenantType === 'enterprise'
      ? tenantType
      : 'enterprise') as FirebaseCustomClaims['tenantType'],
    role: role as UserRole,
    permissions: Array.isArray(permissions)
      ? permissions.filter((p): p is string => typeof p === 'string')
      : [],
  };

  if (Array.isArray(clientIds)) {
    parsed.clientIds = clientIds.filter((id): id is string => typeof id === 'string');
  }

  return parsed;
}

/**
 * Returns the parsed {@link FirebaseCustomClaims} for the current user, or
 * `null` when no user is signed in / claims are not yet provisioned.
 *
 * @param forceRefresh when `true`, forces an ID-token refresh (use after a
 *   server-side claims update so the new tenant/role takes effect immediately).
 */
export async function getCurrentClaims(forceRefresh = false): Promise<FirebaseCustomClaims | null> {
  const user = getFirebaseAuth().currentUser;
  if (user === null) {
    return null;
  }
  const tokenResult = await user.getIdTokenResult(forceRefresh);
  return parseCustomClaims(tokenResult.claims);
}

/** Returns the current user's `tenantId`, or `null` when unavailable. */
export async function getTenantId(): Promise<string | null> {
  const claims = await getCurrentClaims();
  return claims?.tenantId ?? null;
}

/** Returns the current user's {@link UserRole}, or `null` when unavailable. */
export async function getUserRole(): Promise<UserRole | null> {
  const claims = await getCurrentClaims();
  return claims?.role ?? null;
}

/** Re-export so consumers can type their own auth state without a direct SDK dep. */
export type { Auth, ConfirmationResult, FirebaseUser, RecaptchaVerifier, UserCredential };
