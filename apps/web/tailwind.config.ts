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
      // A handful of extra shades that appear on the design canvas
      // (docs/design-system/soteria-assurance-screens.html) but are not part of
      // the @soteria/ui token preset. They are additive surfaces/borders that
      // sit between the existing tokens, kept here (named, commented) so screens
      // can reference them as utilities instead of scattering raw hex.
      colors: {
        // shadcn's `bg-primary` / `text-primary-foreground` need a DEFAULT on
        // the existing primary scale; the 50..900 shades are untouched.
        primary: { DEFAULT: '#1B4F8E', foreground: '#FFFFFF' },
        // Sidebar / chrome navy is the same deep navy as primary-800 (#0A2647);
        // aliased for intent so `bg-sidebar` reads as "the nav shell".
        sidebar: '#0A2647',
        // Hairline card/divider borders — lighter than the token `border`
        // (#D1D9E6). FRAME 03 uses #E6EBF2 for cards and #E3E8F0 for tracks.
        'border-soft': '#E6EBF2',
        'border-track': '#E3E8F0',
        // Muted caption text used for sub-labels (lighter than text-secondary).
        'text-faint': '#8893A4',
        // Heat-map / dense-table label ink.
        ink: '#33404F',
        // Gold light — the brighter accent used on dark (navy) surfaces.
        'gold-light': '#E7C66B',

        // --- shadcn semantic aliases (components/shadcn/) -------------------
        // The shadcn primitives are written against the conventional semantic
        // names (bg-card, text-muted-foreground, ring-ring...). Rather than
        // give them a second palette, each one resolves to the SAME Soteria
        // token value the rest of the app uses, so RULE 5 still holds: there is
        // one source of truth for colour, and shadcn just reads it by another
        // name. `background` and `border` already exist in the token preset
        // with matching semantics, so they are deliberately NOT redefined.
        foreground: '#1A1D23', // = text-primary
        card: { DEFAULT: '#FFFFFF', foreground: '#1A1D23' }, // = surface
        popover: { DEFAULT: '#FFFFFF', foreground: '#1A1D23' },
        muted: { DEFAULT: '#F4F7FB', foreground: '#6B7280' }, // = background/text-secondary
        accent: { DEFAULT: '#E8EEF5', foreground: '#103372' }, // = primary-50/700
        destructive: { DEFAULT: '#C0392B', foreground: '#FFFFFF' }, // = major-nc
        input: '#D1D9E6', // = border token
        ring: '#1B4F8E', // = primary-500
      },
      boxShadow: {
        // Card shadow exactly as specified in the design system recipe.
        'card-soft': '0 2px 8px rgba(10, 38, 71, 0.06)',
        // Overlay / modal elevation from the canvas frames.
        overlay: '0 24px 60px rgba(10, 38, 71, 0.26)',
        // Raised navy/primary CTA shadow used on the dashboard "New Audit" CTA.
        'cta-navy': '0 4px 14px rgba(10, 38, 71, 0.22)',
        'cta-primary': '0 4px 14px rgba(27, 79, 142, 0.28)',
      },
      ringColor: {
        // Focus ring tint from the design system (rgba(27,79,142,.18)).
        focus: 'rgba(27, 79, 142, 0.45)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
