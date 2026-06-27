import type { Config } from 'tailwindcss';
import { soteriaTailwindPreset } from '@soteria/ui/tailwind';

/**
 * Tailwind config for the Soteria Assurance web app.
 *
 * SOTERIA RULE 5 — all colors, typography, spacing, radii and shadows come from
 * the shared design tokens via the {@link soteriaTailwindPreset}. Components use
 * the generated utility classes (e.g. `bg-primary-500`, `text-major-nc`) rather
 * than raw hex or arbitrary spacing values.
 *
 * The preset is typed loosely in the RN-safe `@soteria/ui` package (it has no
 * Tailwind dependency of its own), so we spread it into the strongly-typed
 * `presets` array here. The structural shape matches a Tailwind partial config.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  // The preset is a JSON-serializable partial config from @soteria/ui; its
  // structural type is intentionally narrow there, so we treat it as a Tailwind
  // preset entry here.
  presets: [soteriaTailwindPreset as unknown as Config],
  theme: {
    extend: {
      // Bind the token font families to the next/font CSS variables declared in
      // app/layout.tsx, falling back to the literal family names from the token
      // preset. Keeps RULE 5 (token-named families) while using optimized fonts.
      fontFamily: {
        display: ['var(--font-montserrat)', 'Montserrat', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
