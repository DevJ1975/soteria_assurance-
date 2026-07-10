/**
 * Bundles the Functions entrypoint into a self-contained lib/index.js.
 *
 * WHY: Cloud Functions' build service runs a plain `npm install` against the
 * uploaded functions/package.json — it cannot resolve pnpm `workspace:*`
 * dependencies. The workspace package (@soteria/core) is therefore compiled
 * INTO the bundle (aliased straight to its TypeScript source), while the real
 * runtime dependencies stay external and install from the npm registry.
 *
 * Type checking is NOT esbuild's job — `npm run build` runs `tsc --noEmit`
 * first (see package.json).
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, 'src/index.ts')],
  outfile: path.join(here, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  // Every bare import stays external (installed by Cloud Build from
  // package.json) EXCEPT @soteria/core, which the alias rewrites to a relative
  // source path before the external check — so it gets bundled.
  packages: 'external',
  alias: { '@soteria/core': path.join(here, '../packages/core/src/index.ts') },
  logLevel: 'info',
});
