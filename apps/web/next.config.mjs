// @ts-check

/**
 * Build-time guard for the public Supabase config.
 *
 * A static-export build SUCCEEDS without the `NEXT_PUBLIC_SUPABASE_*` values (they
 * inline as `undefined` and the runtime `ErrorBoundary` shows a readable
 * "not configured" message). That is correct for local dev, CI typecheck builds,
 * and CI (which validates the vars separately). But a real
 * Vercel deploy that forgets these would only fail at *runtime*, in the browser.
 *
 * So: on a Vercel production/preview deploy we fail the build fast with the exact
 * missing keys; everywhere else we warn and continue (preserving the offline /
 * config-less build path). Set `SOTERIA_SKIP_ENV_CHECK=1` to bypass entirely.
 */
const REQUIRED_SUPABASE_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

function assertSupabaseEnv() {
  if (process.env.SOTERIA_SKIP_ENV_CHECK === '1') {
    return;
  }

  const missing = REQUIRED_SUPABASE_ENV.filter((key) => {
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
    `Missing required public Supabase config: ${missing.join(', ')}. ` +
    'Set these in the deployment environment or in apps/web/.env.local.';

  if (isVercelDeploy) {
    throw new Error(`[Soteria] ${detail}`);
  }
  // eslint-disable-next-line no-console
  console.warn(`\n[Soteria] WARNING: ${detail}\n`);
}

assertSupabaseEnv();

/**
 * Next.js config for the Soteria Assurance web app.
 *
 * The app uses Supabase session-refresh middleware, so it must run on a
 * runtime-capable host rather than a static-only export.
 *   - `transpilePackages` lets Next compile the workspace TS source of the
 *     shared Soteria packages directly (they ship `dist`, but we also support
 *     transpiling from source for local dev convenience).
 *   - `trailingSlash` makes every route emit `route/index.html`.
 *
 * Because static export cannot resolve unknown dynamic route params at build
 * time, NO `[id]` folder segments are used: every route is statically known and
 * entity IDs travel via query params read with `useSearchParams()`.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  images: { unoptimized: true },
  transpilePackages: ['@soteria/core', '@soteria/ui'],
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
