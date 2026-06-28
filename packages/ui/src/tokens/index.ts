/**
 * Soteria Assurance design tokens.
 *
 * The single source of truth for the brand's colors, typography, spacing,
 * border radii and shadows. Mirrors DESIGN_DOC §14 exactly.
 *
 * This module is intentionally framework-agnostic (pure data) so it can be
 * consumed from both the web (Tailwind/Next.js) and mobile (React Native/Expo)
 * surfaces without pulling React or React-Native into the build.
 *
 * Components MUST reference these tokens rather than raw hex/spacing values.
 */

export const SoteriaTokens = {
  colors: {
    // Primary — Deep Navy (authority, trust, certification)
    primary: {
      50: '#E8EEF5',
      100: '#C5D3E5',
      200: '#9BB2D4',
      300: '#7091C2',
      400: '#4E75B4',
      500: '#1B4F8E', // Brand primary
      600: '#164282',
      700: '#103372',
      800: '#0A2647', // Deep navy - logo/headers
      900: '#061524',
    },
    // Secondary — Steel Teal (technology, precision)
    secondary: {
      500: '#1B8CA8',
      600: '#157893',
    },
    // Accent — Certification Gold (premium, achievement)
    gold: {
      400: '#E2BA5E',
      500: '#C9A84C', // Brand gold
      600: '#A88D3D',
    },
    // Semantic — Findings
    conforming: '#2D9E2D', // Green — Conforming
    minorNC: '#E67E22', // Orange — Minor NC
    majorNC: '#C0392B', // Red — Major NC
    ofi: '#2980B9', // Blue — Opportunity for Improvement
    strongPoint: '#8E44AD', // Purple — Strong Point
    warning: '#E6A817', // Amber — Warnings
    // Neutrals
    background: '#F4F7FB',
    surface: '#FFFFFF',
    border: '#D1D9E6',
    textPrimary: '#1A1D23',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
  },

  typography: {
    fontFamily: {
      display: 'Montserrat', // Headers, clause numbers, audit numbers
      body: 'Inter', // Body text, labels, notes
      mono: 'JetBrains Mono', // Clause codes, NCR numbers, data
    },
    sizes: {
      xs: '11px',
      sm: '13px',
      md: '15px',
      lg: '17px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  shadows: {
    sm: '0 1px 2px rgba(10, 38, 71, 0.06)',
    md: '0 4px 6px rgba(10, 38, 71, 0.08)',
    lg: '0 10px 15px rgba(10, 38, 71, 0.10)',
    card: '0 2px 8px rgba(10, 38, 71, 0.12)',
  },
} as const;

/** The full token object's type (deeply readonly). */
export type SoteriaTokensType = typeof SoteriaTokens;

/** The colors sub-tree. */
export type SoteriaColors = SoteriaTokensType['colors'];

/**
 * A numbered color scale (e.g. the `primary` ramp). Useful for typing helpers
 * that accept a scale and a shade key.
 */
export type SoteriaColorScale = SoteriaTokensType['colors']['primary'];

/** Valid shade keys on the primary color scale (50–900). */
export type SoteriaColorScaleKey = keyof SoteriaColorScale;

/** Union of every top-level color token key. */
export type SoteriaColorKey = keyof SoteriaColors;

/** Typography sub-tree. */
export type SoteriaTypography = SoteriaTokensType['typography'];

/** Font-family token keys (`display` | `body` | `mono`). */
export type SoteriaFontFamilyKey = keyof SoteriaTypography['fontFamily'];

/** Font-size token keys (`xs` … `4xl`). */
export type SoteriaFontSizeKey = keyof SoteriaTypography['sizes'];

/** Font-weight token keys (`regular` … `bold`). */
export type SoteriaFontWeightKey = keyof SoteriaTypography['weights'];

/** Spacing scale keys (`xs` … `3xl`). */
export type SoteriaSpacingKey = keyof SoteriaTokensType['spacing'];

/** Border-radius scale keys (`sm` … `full`). */
export type SoteriaBorderRadiusKey = keyof SoteriaTokensType['borderRadius'];

/** Shadow token keys (`sm` | `md` | `lg` | `card`). */
export type SoteriaShadowKey = keyof SoteriaTokensType['shadows'];
