/**
 * Metro configuration tuned for the Soteria Turborepo monorepo.
 *
 * Metro must be able to (a) watch the shared `packages/*` workspaces so edits
 * to `@soteria/core` / `@soteria/ui` / `@soteria/firebase` hot-reload, and
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

// 3. Prefer a single copy of hoisted singletons (avoids duplicate React).
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
