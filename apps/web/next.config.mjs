// @ts-check

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
