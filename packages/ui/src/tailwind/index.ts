/**
 * Soteria Tailwind CSS preset.
 *
 * A plain, JSON-serializable preset object derived entirely from
 * {@link SoteriaTokens}. It is consumed by the web app's `tailwind.config.ts`
 * via the `presets` array, so it deliberately contains no functions and is
 * typed loosely as a record (Tailwind's own `Config` type is not a dependency
 * of this RN-safe package).
 *
 * This lives on the dedicated `@soteria/ui/tailwind` subpath rather than the
 * package main entry, keeping React Native bundles free of web-only config.
 */

import { SoteriaTokens } from '../tokens/index';

/** A minimal structural type for the bits of a Tailwind preset we emit. */
export interface SoteriaTailwindPreset {
  theme: {
    extend: {
      colors: Record<string, string | Record<string, string>>;
      fontFamily: Record<string, string[]>;
      fontSize: Record<string, string>;
      spacing: Record<string, string>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
    };
  };
}

const { colors, typography, spacing, borderRadius, shadows } = SoteriaTokens;

/**
 * Convert a numeric spacing/radius token (in px) to a Tailwind-friendly `rem`
 * string using the conventional 16px root. Keeps output JSON-serializable.
 */
function pxToRem(px: number): string {
  return `${px / 16}rem`;
}

const colorTokens: Record<string, string | Record<string, string>> = {
  primary: { ...colors.primary },
  secondary: { ...colors.secondary },
  gold: { ...colors.gold },
  // Semantic finding/status colors flattened to single tokens.
  conforming: colors.conforming,
  'minor-nc': colors.minorNC,
  'major-nc': colors.majorNC,
  ofi: colors.ofi,
  'strong-point': colors.strongPoint,
  warning: colors.warning,
  // Neutrals / surfaces.
  background: colors.background,
  surface: colors.surface,
  border: colors.border,
  'text-primary': colors.textPrimary,
  'text-secondary': colors.textSecondary,
  'text-muted': colors.textMuted,
};

const fontFamilyTokens: Record<string, string[]> = {
  display: [typography.fontFamily.display],
  body: [typography.fontFamily.body],
  mono: [typography.fontFamily.mono],
};

const fontSizeTokens: Record<string, string> = { ...typography.sizes };

const spacingTokens: Record<string, string> = Object.fromEntries(
  Object.entries(spacing).map(([key, value]) => [key, pxToRem(value)]),
);

const borderRadiusTokens: Record<string, string> = Object.fromEntries(
  Object.entries(borderRadius).map(([key, value]) => [
    key,
    // `full` is a sentinel pixel value; emit it as the Tailwind keyword.
    key === 'full' ? '9999px' : pxToRem(value),
  ]),
);

const boxShadowTokens: Record<string, string> = { ...shadows };

/**
 * The Soteria Tailwind preset object. Spread into `presets` in a web app's
 * `tailwind.config.ts`.
 */
export const soteriaTailwindPreset: SoteriaTailwindPreset = {
  theme: {
    extend: {
      colors: colorTokens,
      fontFamily: fontFamilyTokens,
      fontSize: fontSizeTokens,
      spacing: spacingTokens,
      borderRadius: borderRadiusTokens,
      boxShadow: boxShadowTokens,
    },
  },
};

export default soteriaTailwindPreset;
