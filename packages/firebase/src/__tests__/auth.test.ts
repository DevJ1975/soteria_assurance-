/**
 * Tests for the auth service.
 *
 * `firebase/auth` is fully mocked; we drive `currentUser` and `getIdTokenResult`
 * to exercise the pure claims-parsing logic and verify the thin SDK wrappers
 * forward the right arguments.
 */

import type { FirebaseCustomClaims } from '@soteria/core';

// Mutable mock auth state shared with the firebase/auth mock below.
interface MockUser {
  getIdTokenResult: jest.Mock;
}
const authState: { currentUser: MockUser | null } = { currentUser: null };

const credentialFactory = jest.fn((idToken: string, accessToken?: string) => ({
  idToken,
  accessToken,
}));

const mockSignInWithCredential = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockCreateUser = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockSendPasswordReset = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithPopup = jest.fn();

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApp: jest.fn(),
  getApps: jest.fn(() => [{ name: 'mock-app' }]),
}));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn() }));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn() }));
jest.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    public scopes: string[] = [];
    public addScope(scope: string): void {
      this.scopes.push(scope);
    }
    public static credential = credentialFactory;
  }
  class MockRecaptchaVerifier {
    public constructor(
      public auth: unknown,
      public containerId: string,
      public params: unknown,
    ) {}
  }
  return {
    getAuth: jest.fn(() => authState),
    GoogleAuthProvider: MockGoogleAuthProvider,
    RecaptchaVerifier: MockRecaptchaVerifier,
    createUserWithEmailAndPassword: mockCreateUser,
    signInWithEmailAndPassword: mockSignInWithEmail,
    signInWithCredential: mockSignInWithCredential,
    signInWithPopup: mockSignInWithPopup,
    signInWithPhoneNumber: jest.fn(),
    updateProfile: mockUpdateProfile,
    sendEmailVerification: mockSendEmailVerification,
    sendPasswordResetEmail: mockSendPasswordReset,
    signOut: mockSignOut,
    onAuthStateChanged: jest.fn(() => jest.fn()),
  };
});

import {
  confirmPhoneCode,
  createRecaptchaVerifier,
  getCurrentClaims,
  getGoogleProvider,
  getTenantId,
  getUserRole,
  registerWithEmail,
  sendVerificationEmail,
  signInWithGoogleCredential,
} from '../auth';

function setUserWithClaims(claims: Record<string, unknown> | null): void {
  if (claims === null) {
    authState.currentUser = null;
    return;
  }
  authState.currentUser = {
    getIdTokenResult: jest.fn(async () => ({ claims })),
  };
}

beforeEach(() => {
  authState.currentUser = null;
});

describe('getCurrentClaims', () => {
  it('returns null when no user is signed in', async () => {
    setUserWithClaims(null);
    await expect(getCurrentClaims()).resolves.toBeNull();
  });

  it('parses valid claims into FirebaseCustomClaims', async () => {
    setUserWithClaims({
      tenantId: 'tenant-1',
      tenantType: 'consultancy',
      role: 'lead_auditor',
      permissions: ['create_audits', 'add_findings', 42],
      clientIds: ['c1', 'c2', 99],
    });

    const claims = (await getCurrentClaims()) as FirebaseCustomClaims;
    expect(claims).toEqual({
      tenantId: 'tenant-1',
      tenantType: 'consultancy',
      role: 'lead_auditor',
      permissions: ['create_audits', 'add_findings'],
      clientIds: ['c1', 'c2'],
    });
  });

  it('returns null when mandatory tenantId/role claims are absent', async () => {
    setUserWithClaims({ permissions: ['x'] });
    await expect(getCurrentClaims()).resolves.toBeNull();
  });

  it('defaults an unknown tenantType to "enterprise" and empty permissions', async () => {
    setUserWithClaims({ tenantId: 't', role: 'viewer', tenantType: 'bogus' });
    const claims = (await getCurrentClaims()) as FirebaseCustomClaims;
    expect(claims.tenantType).toBe('enterprise');
    expect(claims.permissions).toEqual([]);
    expect(claims.clientIds).toBeUndefined();
  });

  it('forwards forceRefresh to getIdTokenResult', async () => {
    setUserWithClaims({ tenantId: 't', role: 'auditor' });
    await getCurrentClaims(true);
    expect(authState.currentUser?.getIdTokenResult).toHaveBeenCalledWith(true);
  });
});

describe('getTenantId / getUserRole', () => {
  it('returns the tenantId and role from claims', async () => {
    setUserWithClaims({ tenantId: 'tenant-9', role: 'tenant_admin' });
    await expect(getTenantId()).resolves.toBe('tenant-9');
    await expect(getUserRole()).resolves.toBe('tenant_admin');
  });

  it('returns null when unauthenticated', async () => {
    setUserWithClaims(null);
    await expect(getTenantId()).resolves.toBeNull();
    await expect(getUserRole()).resolves.toBeNull();
  });
});

describe('email/password helpers', () => {
  it('registerWithEmail creates the user, sets the name and sends verification', async () => {
    const user = { uid: 'u1' };
    mockCreateUser.mockResolvedValueOnce({ user });

    await registerWithEmail('a@b.com', 'pw', 'Ada Lovelace');

    expect(mockCreateUser).toHaveBeenCalledWith(authState, 'a@b.com', 'pw');
    expect(mockUpdateProfile).toHaveBeenCalledWith(user, { displayName: 'Ada Lovelace' });
    expect(mockSendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('sendVerificationEmail throws when no user is signed in', () => {
    setUserWithClaims(null);
    expect(() => sendVerificationEmail()).toThrow(/no user is signed in/);
  });

  it('sendVerificationEmail sends to the current user', () => {
    setUserWithClaims({ tenantId: 't', role: 'auditor' });
    sendVerificationEmail();
    expect(mockSendEmailVerification).toHaveBeenCalledWith(authState.currentUser);
  });
});

describe('Google helpers', () => {
  it('getGoogleProvider requests email + profile scopes', () => {
    const provider = getGoogleProvider() as unknown as { scopes: string[] };
    expect(provider.scopes).toEqual(['email', 'profile']);
  });

  it('signInWithGoogleCredential builds a credential and signs in (RN flow)', async () => {
    mockSignInWithCredential.mockResolvedValueOnce({ user: { uid: 'g1' } });
    await signInWithGoogleCredential('id-token', 'access-token');

    expect(credentialFactory).toHaveBeenCalledWith('id-token', 'access-token');
    expect(mockSignInWithCredential).toHaveBeenCalledWith(authState, {
      idToken: 'id-token',
      accessToken: 'access-token',
    });
  });
});

describe('phone helpers', () => {
  it('createRecaptchaVerifier builds an invisible verifier bound to a container', () => {
    const verifier = createRecaptchaVerifier('recaptcha-container') as unknown as {
      containerId: string;
      params: { size: string };
    };
    expect(verifier.containerId).toBe('recaptcha-container');
    expect(verifier.params).toEqual({ size: 'invisible' });
  });

  it('confirmPhoneCode delegates to the confirmation result', async () => {
    const confirm = jest.fn().mockResolvedValue({ user: { uid: 'p1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal ConfirmationResult stub
    await confirmPhoneCode({ confirm } as any, '123456');
    expect(confirm).toHaveBeenCalledWith('123456');
  });
});
