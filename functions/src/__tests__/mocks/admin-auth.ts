/** Test double for `firebase-admin/auth`. */

import type { App } from './admin-app';

export interface Auth {
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}

let setClaimsImpl: (uid: string, claims: Record<string, unknown>) => Promise<void> = async () => {};

/** Test helper: install a spy/impl for setCustomUserClaims. */
export function __setSetCustomUserClaims(
  impl: (uid: string, claims: Record<string, unknown>) => Promise<void>,
): void {
  setClaimsImpl = impl;
}

export function getAuth(_app: App): Auth {
  return {
    setCustomUserClaims: (uid, claims) => setClaimsImpl(uid, claims),
  };
}
