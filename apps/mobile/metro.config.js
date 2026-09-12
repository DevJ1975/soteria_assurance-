/**
 * Metro configuration tuned for the Soteria Turborepo monorepo.
 *
 * Metro must be able to (a) watch the shared `packages/*` workspaces so edits
 * to `@soteria/core` / `@soteria/ui` hot-reload, and
 * (b) resolve hoisted dependencies from both the app-level and the root
 * `node_modules`.
 *
 * @see https://docs.expo.dev/guides/monorepos/
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes to shared packages are picked up.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app first, then the hoisted root store.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Hierarchical lookup stays ON. It is tempting to disable it to force a
// single copy of React, and that is right in a hoisted npm/yarn monorepo where
// every dependency really is in one of the two paths above. Under pnpm it is
// exactly wrong: each package's dependencies live beside it inside
// node_modules/.pnpm, and Metro finds them only by walking up from the
// importing file. With it disabled, bundling fails on the first transitive
// dependency Metro cannot see — @react-navigation/native from expo-router,
// whatwg-fetch from @expo/metro-runtime, and so on.
//
// pnpm already guarantees one React per app, so nothing is lost by leaving it
// on. `config.resolver.disableHierarchicalLookup` is deliberately not set.

module.exports = config;
