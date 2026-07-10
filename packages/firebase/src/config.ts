/**
 * Firebase app bootstrap and singleton accessors.
 *
 * This module is the single source of truth for initialising the modular
 * Firebase JS SDK (`firebase` ^11) and is shared by BOTH the Next.js web app
 * and the Expo mobile app. It is platform-agnostic: it relies only on the
 * Firebase SDK and on `process.env`, never on DOM globals.
 *
 * SOTERIA RULE 3 — the Firebase WEB config (apiKey/appId/etc.) is NOT secret.
 * It is read from public env vars (`NEXT_PUBLIC_FIREBASE_*` on web,
 * `EXPO_PUBLIC_FIREBASE_*` on mobile). Server-only secrets
 * (ANTHROPIC_API_KEY, SENDGRID_API_KEY) are NEVER read here — they live only
 * in Firebase Functions via `defineSecret()`.
 *
 * @packageDocumentation
 */

import { type FirebaseApp, type FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { type Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { type FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { FIREBASE_FUNCTIONS_REGION } from '@soteria/core';

/**
 * The Firebase project number, which doubles as the `messagingSenderId`.
 *
 * This is public (it appears in every client bundle) and is safe to ship as a
 * default. See MONOREPO CONTRACT (project number 830573978482).
 */
export const DEFAULT_MESSAGING_SENDER_ID = '830573978482';

/**
 * Reads a public env var trying the Next.js (`NEXT_PUBLIC_*`) name first and
 * the Expo (`EXPO_PUBLIC_*`) name second, so the same code works on both
 * platforms. Returns `undefined` when neither is set.
 */
function readPublicEnv(suffix: string): string | undefined {
  const nextKey = `NEXT_PUBLIC_FIREBASE_${suffix}`;
  const expoKey = `EXPO_PUBLIC_FIREBASE_${suffix}`;
  // `process.env` is the lowest-common-denominator config surface available in
  // both the Next.js and Expo bundlers (both inline these at build time).
  const fromNext = process.env[nextKey];
  if (fromNext !== undefined && fromNext !== '') {
    return fromNext;
  }
  const fromExpo = process.env[expoKey];
  if (fromExpo !== undefined && fromExpo !== '') {
    return fromExpo;
  }
  return undefined;
}

/**
 * Public config keys (env-var suffixes) that MUST be present for the Firebase
 * app to initialise. `MESSAGING_SENDER_ID` is intentionally excluded — it
 * defaults to {@link DEFAULT_MESSAGING_SENDER_ID}; `MEASUREMENT_ID` is optional.
 * Single source of truth for both {@link getFirebaseConfig} (which throws) and
 * {@link getFirebaseConfigStatus} (which does not).
 */
const REQUIRED_PUBLIC_CONFIG_SUFFIXES = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'APP_ID',
] as const;

/**
 * Thrown when a required public Firebase config value is missing from the
 * environment. Surfacing a typed error (rather than letting the SDK fail with
 * an opaque message) makes misconfiguration obvious during app start-up.
 */
export class FirebaseConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'FirebaseConfigError';
  }
}

/** Result of {@link getFirebaseConfigStatus}. */
export interface FirebaseConfigStatus {
  /** `true` when every required public config value is present. */
  configured: boolean;
  /**
   * The env-var suffixes that are missing (e.g. `['API_KEY', 'APP_ID']`); empty
   * when {@link FirebaseConfigStatus.configured} is `true`. Prefix with
   * `NEXT_PUBLIC_FIREBASE_` (web) or `EXPO_PUBLIC_FIREBASE_` (mobile) for the
   * actual variable name.
   */
  missing: string[];
}

/**
 * Non-throwing counterpart to {@link getFirebaseConfig}: reports whether the
 * required public config is present WITHOUT initialising the SDK. The app
 * shells use this to render an actionable "configuration required" screen
 * instead of white-screening when the env vars are absent (a single throw at
 * the provider root would otherwise unmount the whole React tree).
 */
export function getFirebaseConfigStatus(): FirebaseConfigStatus {
  const missing = REQUIRED_PUBLIC_CONFIG_SUFFIXES.filter(
    (suffix) => readPublicEnv(suffix) === undefined,
  );
  return { configured: missing.length === 0, missing: [...missing] };
}

/**
 * Builds the public {@link FirebaseOptions} from environment variables.
 *
 * Required keys: apiKey, authDomain, projectId, storageBucket, appId.
 * `messagingSenderId` defaults to {@link DEFAULT_MESSAGING_SENDER_ID} when not
 * provided.
 *
 * @throws {FirebaseConfigError} when a required value is missing.
 */
export function getFirebaseConfig(): FirebaseOptions {
  const apiKey = readPublicEnv('API_KEY');
  const authDomain = readPublicEnv('AUTH_DOMAIN');
  const projectId = readPublicEnv('PROJECT_ID');
  const storageBucket = readPublicEnv('STORAGE_BUCKET');
  const appId = readPublicEnv('APP_ID');
  const messagingSenderId = readPublicEnv('MESSAGING_SENDER_ID') ?? DEFAULT_MESSAGING_SENDER_ID;
  // Optional: only present when Google Analytics is enabled for the web app.
  const measurementId = readPublicEnv('MEASUREMENT_ID');

  const { missing } = getFirebaseConfigStatus();
  if (missing.length > 0) {
    throw new FirebaseConfigError(
      `Missing required Firebase config env var(s): ${missing
        .map((key) => `NEXT_PUBLIC_FIREBASE_${key} / EXPO_PUBLIC_FIREBASE_${key}`)
        .join(', ')}`,
    );
  }

  // Non-null assertions are safe here: any missing required value was collected
  // above and would have thrown before reaching this point.
  return {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId,
    appId: appId!,
    // measurementId is optional in FirebaseOptions; include it only when set so
    // analytics can be initialised by the web app when desired.
    ...(measurementId !== undefined ? { measurementId } : {}),
  };
}

/**
 * Returns the Google Analytics `measurementId` when configured, else
 * `undefined`. The web app uses this to lazily initialise Firebase Analytics
 * (a browser-only feature); mobile ignores it.
 */
export function getFirebaseMeasurementId(): string | undefined {
  return readPublicEnv('MEASUREMENT_ID');
}

/**
 * Initialises the Firebase app exactly once.
 *
 * Re-initialisation is guarded via {@link getApps}: in dev/HMR or multiple
 * imports the already-initialised app is returned instead of throwing.
 */
export function initFirebase(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(getFirebaseConfig());
}

/** Returns the singleton {@link FirebaseApp}, initialising it on first use. */
export function getFirebaseApp(): FirebaseApp {
  return initFirebase();
}

/** Returns the {@link Auth} instance for the singleton app. */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Returns the {@link Firestore} instance for the singleton app. */
export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

/** Returns the {@link FirebaseStorage} instance for the singleton app. */
export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

/**
 * Returns the {@link Functions} instance pinned to the deployed region.
 *
 * ALWAYS use this instead of calling `getFunctions(app)` directly: the
 * region-less overload relies on the SDK's default region, which silently
 * breaks the moment the deploy region changes. The shared
 * {@link FIREBASE_FUNCTIONS_REGION} constant keeps clients and the Functions
 * runtime (`setGlobalOptions({ region })` in functions/src/index.ts) aligned.
 */
export function getFirebaseFunctions(): Functions {
  return getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);
}

/** Host the local emulator suite binds to by default. */
const EMULATOR_HOST = '127.0.0.1';
const AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_PORT = 8080;
const STORAGE_EMULATOR_PORT = 9199;
/** Must match `emulators.functions.port` in firebase.json. */
const FUNCTIONS_EMULATOR_PORT = 5001;

/**
 * Reads the "use emulator" flag from either the Next.js or Expo public env var.
 */
function shouldUseEmulators(): boolean {
  const next = process.env.NEXT_PUBLIC_USE_EMULATOR;
  const expo = process.env.EXPO_PUBLIC_USE_EMULATOR;
  return next === 'true' || next === '1' || expo === 'true' || expo === '1';
}

// Module-level guard so the emulator wiring (which throws if applied twice to
// the same SDK instance) runs at most once per process.
let emulatorsConnected = false;

/**
 * Wires the Auth, Firestore, Storage and Functions SDK instances to the local
 * Firebase Emulator Suite when `NEXT_PUBLIC_USE_EMULATOR` /
 * `EXPO_PUBLIC_USE_EMULATOR` is set to `true`/`1`. No-op otherwise.
 *
 * Idempotent: safe to call from app start-up on every render/import.
 *
 * @returns `true` if emulators were (or had already been) wired, else `false`.
 */
export function connectEmulatorsIfConfigured(): boolean {
  if (!shouldUseEmulators()) {
    return false;
  }
  if (emulatorsConnected) {
    return true;
  }

  connectAuthEmulator(getFirebaseAuth(), `http://${EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(getFirebaseDb(), EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
  connectStorageEmulator(getFirebaseStorage(), EMULATOR_HOST, STORAGE_EMULATOR_PORT);
  // Without this, emulator-mode callables would silently target PRODUCTION
  // functions while auth/firestore/storage talk to the emulator.
  connectFunctionsEmulator(getFirebaseFunctions(), EMULATOR_HOST, FUNCTIONS_EMULATOR_PORT);

  emulatorsConnected = true;
  return true;
}
