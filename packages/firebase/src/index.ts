/**
 * `@soteria/firebase` — shared modular Firebase JS SDK (`firebase` ^11)
 * wrapper used by BOTH the Next.js web app and the Expo mobile app.
 *
 * Re-exports the four sub-modules: config (app bootstrap), auth, firestore
 * (strictly tenant-scoped), and storage.
 *
 * @packageDocumentation
 */

export * from './config';
export * from './auth';
export * from './firestore';
export * from './storage';
