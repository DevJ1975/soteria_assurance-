// @ts-check

/**
 * Build-time guard for the public Firebase config.
 *
 * A static-export build SUCCEEDS without the `NEXT_PUBLIC_FIREBASE_*` values (they
 * inline as `undefined` and the runtime `ErrorBoundary` shows a readable
 * "not configured" message). That is correct for local dev, CI typecheck builds,
 * and Firebase-Hosting CI (which validates the vars separately). But a real
 * Vercel deploy that forgets these would only fail at *runtime*, in the browser.
 *
 * So: on a Vercel production/preview deploy we fail the build fast with the exact
 * missing keys; everywhere else we warn and continue (preserving the offline /
 * config-less build path). Set `SOTERIA_SKIP_ENV_CHECK=1` to bypass entirely.
 */
const REQUIRED_FIREBASE_ENV = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

function assertFirebaseEnv() {
  if (process.env.SOTERIA_SKIP_ENV_CHECK === '1') {
    return;
  }

  const missing = REQUIRED_FIREBASE_ENV.filter((key) => {
    const value = process.env[key];
    return value === undefined || value.trim() === '';
  });
  if (missing.length === 0) {
    return;
  }

  // Vercel sets VERCEL=1 and VERCEL_ENV to production | preview | development.
  const isVercelDeploy =
    process.env.VERCEL === '1' &&
    (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview');

  const detail =
    `Missing required public Firebase config: ${missing.join(', ')}. ` +
    'Set these in the Vercel project (Settings → Environment Variables) or in ' +
    'apps/web/.env.local — they are public client keys (see docs/DEPLOYMENT.md).';

  if (isVercelDeploy) {
    throw new Error(`[Soteria] ${detail}`);
  }
  // eslint-disable-next-line no-console
  console.warn(`\n[Soteria] WARNING: ${detail}\n`);
}

assertFirebaseEnv();

/**
 * Next.js config for the Soteria Assurance web app.
 *
 * MUST be deployable to Firebase Hosting as a fully static export:
 *   - `output: 'export'` emits a static `out/` directory (firebase.json Hosting
 *     points at apps/web/out).
 *   - `images.unoptimized` is required because the Next Image Optimization
 *     server is unavailable in a static export.
 *   - `transpilePackages` lets Next compile the workspace TS source of the
 *     shared Soteria packages directly (they ship `dist`, but we also support
 *     transpiling from source for local dev convenience).
 *   - `trailingSlash` makes every route emit `route/index.html`, which Firebase
 *     Hosting serves cleanly.
 *
 * Because static export cannot resolve unknown dynamic route params at build
 * time, NO `[id]` folder segments are used: every route is statically known and
 * entity IDs travel via query params read with `useSearchParams()`.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@soteria/core', '@soteria/ui', '@soteria/firebase'],
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
