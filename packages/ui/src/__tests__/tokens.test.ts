import { SoteriaTokens } from '../tokens/index';

/** Matches `#RGB`, `#RRGGBB` or `#RRGGBBAA` hex color strings. */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Recursively collect every string value in a nested record. */
function collectStrings(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).flatMap(
      collectStrings,
    );
  }
  return [];
}

describe('SoteriaTokens structure integrity', () => {
  it('exposes all top-level token groups', () => {
    expect(Object.keys(SoteriaTokens).sort()).toEqual(
      [
        'borderRadius',
        'colors',
        'shadows',
        'spacing',
        'typography',
      ].sort(),
    );
  });

  describe('colors', () => {
    const { colors } = SoteriaTokens;

    it('includes the full primary 50–900 scale', () => {
      const expected = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
      expect(Object.keys(colors.primary).map(Number).sort((a, b) => a - b)).toEqual(
        expected,
      );
    });

    it('includes the secondary and gold scales', () => {
      expect(Object.keys(colors.secondary)).toEqual(['500', '600']);
      expect(Object.keys(colors.gold)).toEqual(['400', '500', '600']);
    });

    it('defines every semantic finding color', () => {
      expect(colors.conforming).toBe('#2D9E2D');
      expect(colors.minorNC).toBe('#E67E22');
      expect(colors.majorNC).toBe('#C0392B');
      expect(colors.ofi).toBe('#2980B9');
      expect(colors.strongPoint).toBe('#8E44AD');
      expect(colors.warning).toBe('#E6A817');
    });

    it('defines the neutral/surface tokens', () => {
      expect(colors.background).toBe('#F4F7FB');
      expect(colors.surface).toBe('#FFFFFF');
      expect(colors.border).toBe('#D1D9E6');
      expect(colors.textPrimary).toBe('#1A1D23');
      expect(colors.textSecondary).toBe('#6B7280');
      expect(colors.textMuted).toBe('#9CA3AF');
    });

    it('only contains valid hex color strings', () => {
      for (const value of collectStrings(colors)) {
        expect(value).toMatch(HEX_RE);
      }
    });

    it('brand anchors match DESIGN_DOC §14', () => {
      expect(colors.primary[500]).toBe('#1B4F8E');
      expect(colors.primary[800]).toBe('#0A2647');
      expect(colors.gold[500]).toBe('#C9A84C');
      expect(colors.secondary[500]).toBe('#1B8CA8');
    });
  });

  describe('typography', () => {
    const { typography } = SoteriaTokens;

    it('defines the three font families', () => {
      expect(typography.fontFamily).toEqual({
        display: 'Montserrat',
        body: 'Inter',
        mono: 'JetBrains Mono',
      });
    });

    it('defines the full size ramp with px units', () => {
      expect(Object.keys(typography.sizes)).toEqual([
        'xs',
        'sm',
        'md',
        'lg',
        'xl',
        '2xl',
        '3xl',
        '4xl',
      ]);
      for (const value of Object.values(typography.sizes)) {
        expect(value).toMatch(/^\d+px$/);
      }
    });

    it('defines numeric font-weight strings', () => {
      expect(typography.weights).toEqual({
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      });
    });
  });

  describe('spacing', () => {
    it('defines a numeric (px) spacing scale', () => {
      const { spacing } = SoteriaTokens;
      expect(spacing).toEqual({
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        '2xl': 48,
        '3xl': 64,
      });
      for (const value of Object.values(spacing)) {
        expect(typeof value).toBe('number');
      }
    });
  });

  describe('borderRadius', () => {
    it('defines a numeric radius scale incl. full sentinel', () => {
      expect(SoteriaTokens.borderRadius).toEqual({
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
      });
    });
  });

  describe('shadows', () => {
    it('defines sm/md/lg/card box-shadow strings', () => {
      const { shadows } = SoteriaTokens;
      expect(Object.keys(shadows)).toEqual(['sm', 'md', 'lg', 'card']);
      for (const value of Object.values(shadows)) {
        expect(value).toMatch(/rgba\(10, 38, 71/);
      }
    });
  });
});
