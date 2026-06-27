import preset, { soteriaTailwindPreset } from '../tailwind/index';
import { SoteriaTokens } from '../tokens/index';

describe('soteriaTailwindPreset', () => {
  it('exports the same object as default and named export', () => {
    expect(preset).toBe(soteriaTailwindPreset);
  });

  it('exposes a theme.extend with all token groups', () => {
    const { extend } = soteriaTailwindPreset.theme;
    expect(Object.keys(extend).sort()).toEqual(
      [
        'borderRadius',
        'boxShadow',
        'colors',
        'fontFamily',
        'fontSize',
        'spacing',
      ].sort(),
    );
  });

  describe('colors map', () => {
    const { colors } = soteriaTailwindPreset.theme.extend;

    it('preserves the nested primary scale', () => {
      expect(colors.primary).toEqual({ ...SoteriaTokens.colors.primary });
    });

    it('flattens semantic finding colors to kebab-case tokens', () => {
      expect(colors['major-nc']).toBe(SoteriaTokens.colors.majorNC);
      expect(colors['minor-nc']).toBe(SoteriaTokens.colors.minorNC);
      expect(colors.ofi).toBe(SoteriaTokens.colors.ofi);
      expect(colors['strong-point']).toBe(SoteriaTokens.colors.strongPoint);
      expect(colors.conforming).toBe(SoteriaTokens.colors.conforming);
      expect(colors.warning).toBe(SoteriaTokens.colors.warning);
    });

    it('includes neutral/surface tokens', () => {
      expect(colors.surface).toBe(SoteriaTokens.colors.surface);
      expect(colors['text-primary']).toBe(SoteriaTokens.colors.textPrimary);
    });
  });

  describe('fontFamily', () => {
    it('emits string arrays per family', () => {
      const { fontFamily } = soteriaTailwindPreset.theme.extend;
      expect(fontFamily.display).toEqual(['Montserrat']);
      expect(fontFamily.body).toEqual(['Inter']);
      expect(fontFamily.mono).toEqual(['JetBrains Mono']);
    });
  });

  describe('fontSize', () => {
    it('mirrors the token size ramp verbatim', () => {
      expect(soteriaTailwindPreset.theme.extend.fontSize).toEqual({
        ...SoteriaTokens.typography.sizes,
      });
    });
  });

  describe('spacing', () => {
    it('converts numeric px tokens to rem strings', () => {
      const { spacing } = soteriaTailwindPreset.theme.extend;
      expect(spacing.xs).toBe('0.25rem'); // 4 / 16
      expect(spacing.md).toBe('1rem'); // 16 / 16
      expect(spacing['3xl']).toBe('4rem'); // 64 / 16
    });
  });

  describe('borderRadius', () => {
    it('converts px to rem and keeps the full sentinel as px', () => {
      const { borderRadius } = soteriaTailwindPreset.theme.extend;
      expect(borderRadius.sm).toBe('0.25rem'); // 4 / 16
      expect(borderRadius.xl).toBe('1rem'); // 16 / 16
      expect(borderRadius.full).toBe('9999px');
    });
  });

  describe('boxShadow', () => {
    it('mirrors the token shadow strings verbatim', () => {
      expect(soteriaTailwindPreset.theme.extend.boxShadow).toEqual({
        ...SoteriaTokens.shadows,
      });
    });
  });

  it('is JSON-serializable (no functions, round-trips cleanly)', () => {
    const json = JSON.stringify(soteriaTailwindPreset);
    expect(typeof json).toBe('string');
    expect(JSON.parse(json)).toEqual(soteriaTailwindPreset);
  });
});
