import type { FindingType, ConformityStatus } from '@soteria/core';
import { FINDING_TYPE_META, CONFORMITY_STATUS_META } from '@soteria/core';

import { getFindingColor, getConformityColor } from '../tokens/findingColors';
import { SoteriaTokens } from '../tokens/index';

const HEX_RE = /^#(?:[0-9a-fA-F]{6})$/;

const ALL_FINDING_TYPES = Object.keys(FINDING_TYPE_META) as FindingType[];
const ALL_CONFORMITY_STATUSES = Object.keys(
  CONFORMITY_STATUS_META,
) as ConformityStatus[];

describe('getFindingColor', () => {
  it.each(ALL_FINDING_TYPES)('returns a valid hex color for %s', (type) => {
    expect(getFindingColor(type)).toMatch(HEX_RE);
  });

  it('maps each type to the expected token color', () => {
    expect(getFindingColor('major_nc')).toBe(SoteriaTokens.colors.majorNC);
    expect(getFindingColor('minor_nc')).toBe(SoteriaTokens.colors.minorNC);
    expect(getFindingColor('ofi')).toBe(SoteriaTokens.colors.ofi);
    expect(getFindingColor('strong_point')).toBe(
      SoteriaTokens.colors.strongPoint,
    );
    expect(getFindingColor('observation')).toBe(
      SoteriaTokens.colors.textSecondary,
    );
  });

  it('stays in lock-step with @soteria/core FINDING_TYPE_META colors', () => {
    for (const type of ALL_FINDING_TYPES) {
      expect(getFindingColor(type).toUpperCase()).toBe(
        FINDING_TYPE_META[type].colorHex.toUpperCase(),
      );
    }
  });
});

describe('getConformityColor', () => {
  it.each(ALL_CONFORMITY_STATUSES)(
    'returns a valid hex color for %s',
    (status) => {
      expect(getConformityColor(status)).toMatch(HEX_RE);
    },
  );

  it('maps each status to the expected token color', () => {
    expect(getConformityColor('conforming')).toBe(
      SoteriaTokens.colors.conforming,
    );
    expect(getConformityColor('major_nc')).toBe(SoteriaTokens.colors.majorNC);
    expect(getConformityColor('minor_nc')).toBe(SoteriaTokens.colors.minorNC);
    expect(getConformityColor('not_audited')).toBe(
      SoteriaTokens.colors.textMuted,
    );
    expect(getConformityColor('not_applicable')).toBe(
      SoteriaTokens.colors.textSecondary,
    );
  });

  it('stays in lock-step with @soteria/core CONFORMITY_STATUS_META colors', () => {
    for (const status of ALL_CONFORMITY_STATUSES) {
      expect(getConformityColor(status).toUpperCase()).toBe(
        CONFORMITY_STATUS_META[status].colorHex.toUpperCase(),
      );
    }
  });
});
