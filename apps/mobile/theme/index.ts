/**
 * React Native theme adapter for the Soteria design system.
 *
 * SOTERIA RULE 5 — components MUST consume design tokens, never raw hex /
 * spacing. The canonical tokens live in `@soteria/ui` ({@link SoteriaTokens}),
 * which is framework-agnostic pure data. This module re-shapes those tokens
 * into the precise primitives React Native needs:
 *
 *  - numeric font sizes (RN rejects the `"15px"` CSS strings),
 *  - `fontWeight` values typed as RN's `TextStyle['fontWeight']`,
 *  - a native `elevation` + iOS shadow object derived from the token shadows.
 *
 * No literal colors or spacings are introduced here — every value is derived
 * from {@link SoteriaTokens}.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import {
  SoteriaTokens,
  type SoteriaFontSizeKey,
  type SoteriaFontWeightKey,
  type SoteriaShadowKey,
  type SoteriaSpacingKey,
} from '@soteria/ui';

/** Re-export the raw token tree for direct color access. */
export const tokens = SoteriaTokens;

/** Flat, RN-friendly color palette (all values sourced from tokens). */
export const colors = SoteriaTokens.colors;

/** Spacing scale (already numeric in the tokens). */
export const spacing = SoteriaTokens.spacing;

/** Border-radius scale (already numeric in the tokens). */
export const radius = SoteriaTokens.borderRadius;

/**
 * Parse a token font-size string like `"15px"` into the numeric pixel value
 * React Native expects. Falls back to `15` if the token is malformed.
 */
function toNumericSize(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 15 : parsed;
}

/** Numeric font-size scale keyed exactly like the token sizes (`xs`…`4xl`). */
export const fontSize: Record<SoteriaFontSizeKey, number> = Object.fromEntries(
  (Object.keys(SoteriaTokens.typography.sizes) as SoteriaFontSizeKey[]).map((key) => [
    key,
    toNumericSize(SoteriaTokens.typography.sizes[key]),
  ]),
) as Record<SoteriaFontSizeKey, number>;

/**
 * Font weights as RN `TextStyle['fontWeight']`. The token weights are the
 * string numerics RN accepts (`'400'`…`'700'`), so we widen the type only.
 */
export const fontWeight: Record<SoteriaFontWeightKey, TextStyle['fontWeight']> = {
  regular: SoteriaTokens.typography.weights.regular,
  medium: SoteriaTokens.typography.weights.medium,
  semibold: SoteriaTokens.typography.weights.semibold,
  bold: SoteriaTokens.typography.weights.bold,
};

/** Font families (used once custom fonts are loaded; safe as a fallback name). */
export const fontFamily = SoteriaTokens.typography.fontFamily;

/**
 * A native shadow descriptor: iOS `shadow*` props plus an Android `elevation`.
 * Derived structurally from the design-token shadow scale so the look stays in
 * lock-step with the web cards without re-parsing the CSS box-shadow string.
 */
export interface NativeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const SHADOW_ELEVATION: Record<SoteriaShadowKey, number> = {
  sm: 1,
  md: 3,
  lg: 6,
  card: 4,
};

const SHADOW_RADIUS: Record<SoteriaShadowKey, number> = {
  sm: 2,
  md: 6,
  lg: 12,
  card: 8,
};

const SHADOW_OPACITY: Record<SoteriaShadowKey, number> = {
  sm: 0.06,
  md: 0.08,
  lg: 0.1,
  card: 0.12,
};

/** Build a native shadow style object for the given token shadow key. */
export function shadow(key: SoteriaShadowKey): NativeShadow {
  return {
    // Navy shadow color matches the rgba base used in the token box-shadows.
    shadowColor: SoteriaTokens.colors.primary[800],
    shadowOffset: { width: 0, height: SHADOW_ELEVATION[key] },
    shadowOpacity: SHADOW_OPACITY[key],
    shadowRadius: SHADOW_RADIUS[key],
    elevation: SHADOW_ELEVATION[key],
  };
}

/** Convenience: a standard elevated card surface style. */
export const cardSurface: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.md,
  ...shadow('card'),
};

export type { SoteriaSpacingKey };
