/**
 * Firebase Admin SDK singleton.
 *
 * Initialises the Admin app exactly once per process and exposes typed
 * accessors for Firestore and Auth. Every module that touches Firestore or
 * Auth MUST import these accessors rather than calling
 * `admin.initializeApp()` directly, so that re-initialisation (which throws)
 * cannot happen.
 *
 * @packageDocumentation
 */

import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Returns the singleton Admin {@link App}, initialising it on first use.
 *
 * In the Functions runtime `initializeApp()` with no arguments picks up the
 * ambient service-account credentials and project config automatically.
 */
export function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) {
    // The default app is always first; non-null because length > 0.
    return existing[0]!;
  }
  return initializeApp();
}

/** Returns the Admin {@link Firestore} instance for the singleton app. */
export function getDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** Returns the Admin {@link Auth} instance for the singleton app. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
