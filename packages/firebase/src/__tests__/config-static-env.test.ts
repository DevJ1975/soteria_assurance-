/**
 * Guards the ONE property of `config.ts` that no behavioural test can observe:
 * that every public env var is read through a fully-spelled-out
 * `process.env.<KEY>` member expression.
 *
 * Under Node (where these tests run) a computed lookup —
 * ``process.env[`NEXT_PUBLIC_FIREBASE_${suffix}`]`` — behaves identically to a
 * literal one, so `config.test.ts` passes either way. In a browser bundle it
 * does not: webpack (Next.js) and Metro (Expo) inline public env vars by
 * textually substituting the exact member expression at build time, and a
 * computed key is invisible to that substitution. It survives into the bundle,
 * resolves against Next's empty `process` shim, and every value comes back
 * `undefined` — so the deployed app threw `FirebaseConfigError` on every page
 * load ("Application error: a client-side exception has occurred") regardless
 * of what was configured at build time.
 *
 * This test therefore asserts against the SOURCE TEXT, which is the only place
 * the distinction is visible.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'config.ts'), 'utf8');

/** Public env vars that must each appear as a literal member expression. */
const REQUIRED_KEYS = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
  'MEASUREMENT_ID',
] as const;

describe('config.ts reads env vars in a bundler-inlinable form', () => {
  it('never uses a computed process.env[...] lookup', () => {
    // Matches `process.env[` — the bracket form is what defeats inlining.
    // Comments are stripped first so the explanatory prose above (and in
    // config.ts) does not trip the check.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/process\s*\.\s*env\s*\[/);
  });

  it.each(REQUIRED_KEYS)('reads NEXT_PUBLIC_FIREBASE_%s as a literal member expression', (key) => {
    expect(SOURCE).toContain(`process.env.NEXT_PUBLIC_FIREBASE_${key}`);
  });

  it.each(REQUIRED_KEYS)('reads EXPO_PUBLIC_FIREBASE_%s as a literal member expression', (key) => {
    expect(SOURCE).toContain(`process.env.EXPO_PUBLIC_FIREBASE_${key}`);
  });

  it('reads the emulator flags as literal member expressions', () => {
    expect(SOURCE).toContain('process.env.NEXT_PUBLIC_USE_EMULATOR');
    expect(SOURCE).toContain('process.env.EXPO_PUBLIC_USE_EMULATOR');
  });
});
