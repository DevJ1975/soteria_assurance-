/**
 * Tests for env-driven Firebase config parsing.
 *
 * The firebase SDK modules are mocked so no real app is initialised.
 */

import {
  DEFAULT_MESSAGING_SENDER_ID,
  FirebaseConfigError,
  connectEmulatorsIfConfigured,
  getFirebaseConfig,
  initFirebase,
} from '../config';
import {
  getApps as mockGetApps,
  initializeApp as mockInitializeApp,
} from 'firebase/app';
import { connectAuthEmulator as mockConnectAuth } from 'firebase/auth';

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
  getApp: jest.fn(() => ({ name: 'mock-app' })),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ __auth: true })),
  connectAuthEmulator: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ __db: true })),
  connectFirestoreEmulator: jest.fn(),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({ __storage: true })),
  connectStorageEmulator: jest.fn(),
}));

function setFullConfig(): void {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'k';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'd';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'p';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'b';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'a';
}

const PUBLIC_KEYS = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
] as const;

function clearFirebaseEnv(): void {
  for (const key of PUBLIC_KEYS) {
    delete process.env[`NEXT_PUBLIC_FIREBASE_${key}`];
    delete process.env[`EXPO_PUBLIC_FIREBASE_${key}`];
  }
  delete process.env.NEXT_PUBLIC_USE_EMULATOR;
  delete process.env.EXPO_PUBLIC_USE_EMULATOR;
}

describe('getFirebaseConfig', () => {
  beforeEach(clearFirebaseEnv);
  afterAll(clearFirebaseEnv);

  it('parses a full NEXT_PUBLIC_* config', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'web-api-key';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'soteria.firebaseapp.com';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'soteria-assurance';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'soteria.appspot.com';
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '111111';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:111:web:abc';

    expect(getFirebaseConfig()).toEqual({
      apiKey: 'web-api-key',
      authDomain: 'soteria.firebaseapp.com',
      projectId: 'soteria-assurance',
      storageBucket: 'soteria.appspot.com',
      messagingSenderId: '111111',
      appId: '1:111:web:abc',
    });
  });

  it('parses a full EXPO_PUBLIC_* config', () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'mobile-api-key';
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'soteria.firebaseapp.com';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'soteria-assurance';
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'soteria.appspot.com';
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:111:ios:def';

    const config = getFirebaseConfig();
    expect(config.apiKey).toBe('mobile-api-key');
    expect(config.appId).toBe('1:111:ios:def');
  });

  it('defaults messagingSenderId to the project number when unset', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'k';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'd';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'p';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'b';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'a';

    expect(getFirebaseConfig().messagingSenderId).toBe(DEFAULT_MESSAGING_SENDER_ID);
    expect(DEFAULT_MESSAGING_SENDER_ID).toBe('830573978482');
  });

  it('prefers the NEXT_PUBLIC_* value over the EXPO_PUBLIC_* value', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'from-next';
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'from-expo';
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'd';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'p';
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'b';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'a';

    expect(getFirebaseConfig().apiKey).toBe('from-next');
  });

  it('treats an empty-string env var as missing', () => {
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = '';
    expect(() => getFirebaseConfig()).toThrow(FirebaseConfigError);
  });

  it('throws a FirebaseConfigError listing every missing required key', () => {
    expect(() => getFirebaseConfig()).toThrow(FirebaseConfigError);
    try {
      getFirebaseConfig();
      fail('expected getFirebaseConfig to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('API_KEY');
      expect(message).toContain('AUTH_DOMAIN');
      expect(message).toContain('PROJECT_ID');
      expect(message).toContain('STORAGE_BUCKET');
      expect(message).toContain('APP_ID');
      // messagingSenderId is optional (has a default) — must NOT be listed.
      expect(message).not.toContain('MESSAGING_SENDER_ID');
    }
  });
});

describe('initFirebase', () => {
  beforeEach(clearFirebaseEnv);
  afterAll(clearFirebaseEnv);

  it('initialises a new app when none exist', () => {
    setFullConfig();
    (mockGetApps as jest.Mock).mockReturnValue([]);
    initFirebase();
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing app instead of re-initialising (HMR guard)', () => {
    setFullConfig();
    (mockGetApps as jest.Mock).mockReturnValue([{ name: 'existing' }]);
    initFirebase();
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });
});

describe('connectEmulatorsIfConfigured', () => {
  beforeEach(() => {
    clearFirebaseEnv();
    setFullConfig();
    (mockGetApps as jest.Mock).mockReturnValue([{ name: 'mock-app' }]);
  });
  afterAll(clearFirebaseEnv);

  it('is a no-op when the emulator flag is unset', () => {
    expect(connectEmulatorsIfConfigured()).toBe(false);
    expect(mockConnectAuth).not.toHaveBeenCalled();
  });

  it('wires auth, firestore and storage emulators when enabled', () => {
    process.env.NEXT_PUBLIC_USE_EMULATOR = 'true';
    setFullConfig();
    // Re-require in an isolated registry so config's one-time
    // `emulatorsConnected` guard is fresh; grab the connect mocks from the
    // same isolated registry so the assertions observe the right instances.
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports -- isolated re-import to reset module-level guard */
      const cfg = require('../config') as typeof import('../config');
      const auth = require('firebase/auth') as { connectAuthEmulator: jest.Mock };
      const fs = require('firebase/firestore') as { connectFirestoreEmulator: jest.Mock };
      const storage = require('firebase/storage') as { connectStorageEmulator: jest.Mock };
      /* eslint-enable @typescript-eslint/no-require-imports */
      expect(cfg.connectEmulatorsIfConfigured()).toBe(true);
      expect(auth.connectAuthEmulator).toHaveBeenCalledTimes(1);
      expect(fs.connectFirestoreEmulator).toHaveBeenCalledTimes(1);
      expect(storage.connectStorageEmulator).toHaveBeenCalledTimes(1);
    });
  });

  it('is idempotent — a second call does not re-wire the emulators', () => {
    process.env.EXPO_PUBLIC_USE_EMULATOR = '1';
    setFullConfig();
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports -- isolated re-import to reset module-level guard */
      const cfg = require('../config') as typeof import('../config');
      const auth = require('firebase/auth') as { connectAuthEmulator: jest.Mock };
      /* eslint-enable @typescript-eslint/no-require-imports */
      expect(cfg.connectEmulatorsIfConfigured()).toBe(true);
      expect(cfg.connectEmulatorsIfConfigured()).toBe(true);
      // Wired exactly once despite two calls.
      expect(auth.connectAuthEmulator).toHaveBeenCalledTimes(1);
    });
  });
});
