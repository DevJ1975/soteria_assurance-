/** Test double for `firebase-admin/auth`. */

import type { App } from './admin-app';

export interface UserRecord {
  uid: string;
  email?: string;
  customClaims?: Record<string, unknown>;
}

export interface Auth {
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  getUser(uid: string): Promise<UserRecord>;
}

let setClaimsImpl: (uid: string, claims: Record<string, unknown>) => Promise<void> = async () => {};
let getUserImpl: (uid: string) => Promise<UserRecord> = async (uid) => ({ uid });

/** Test helper: install a spy/impl for setCustomUserClaims. */
export function __setSetCustomUserClaims(
  impl: (uid: string, claims: Record<string, unknown>) => Promise<void>,
): void {
  setClaimsImpl = impl;
}

/** Test helper: install a spy/impl for getUser (defaults to a claim-less user). */
export function __setGetUser(impl: (uid: string) => Promise<UserRecord>): void {
  getUserImpl = impl;
}

/** Test helper: restore the default claim-less getUser. */
export function __resetAuth(): void {
  setClaimsImpl = async () => {};
  getUserImpl = async (uid) => ({ uid });
}

export function getAuth(_app: App): Auth {
  return {
    setCustomUserClaims: (uid, claims) => setClaimsImpl(uid, claims),
    getUser: (uid) => getUserImpl(uid),
  };
}
