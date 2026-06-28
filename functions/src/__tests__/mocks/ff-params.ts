/** Test double for `firebase-functions/params`. */

export interface SecretParam {
  value(): string;
}

let secretValues: Record<string, string> = {};

/** Test helper: set the value `.value()` returns for a given secret. */
export function __setSecret(name: string, value: string): void {
  secretValues[name] = value;
}

/** Test helper: clear all configured secret values. */
export function __clearSecrets(): void {
  secretValues = {};
}

export function defineSecret(name: string): SecretParam {
  return {
    value(): string {
      const v = secretValues[name];
      if (v === undefined) {
        throw new Error(`Secret ${name} is not available`);
      }
      return v;
    },
  };
}
