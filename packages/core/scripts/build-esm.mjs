/**
 * Bundles @soteria/core to a single ESM file for the Supabase Edge Functions.
 *
 * The functions run on Deno, which cannot consume the CommonJS `dist/` the
 * rest of the workspace uses, and would reject the extensionless relative
 * imports a plain `tsc` ESM emit produces. Bundling to one file sidesteps
 * both — and it matters that they share this build rather than copying the
 * prompts, because a duplicated auditor persona drifts from the one the tests
 * assert against without anything failing.
 *
 * Core has no runtime dependencies, so the bundle is self-contained.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist-esm/index.mjs',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'info',
});
