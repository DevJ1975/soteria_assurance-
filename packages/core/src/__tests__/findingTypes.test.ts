import {
  FINDING_TYPE_META,
  CONFORMITY_STATUS_META,
} from '../constants/findingTypes';
import type { FindingType } from '../types/finding';
import type { ConformityStatus } from '../types/clause';

const FINDING_TYPES: FindingType[] = [
  'major_nc',
  'minor_nc',
  'ofi',
  'strong_point',
  'observation',
];

const CONFORMITY_STATUSES: ConformityStatus[] = [
  'conforming',
  'major_nc',
  'minor_nc',
  'not_audited',
  'not_applicable',
];

describe('FINDING_TYPE_META — DESIGN_DOC §4 + §14', () => {
  it('defines metadata for every finding type', () => {
    for (const type of FINDING_TYPES) {
      expect(FINDING_TYPE_META[type]).toBeDefined();
    }
  });

  it('uses the §4 corrective-action timeframes', () => {
    expect(FINDING_TYPE_META.major_nc.correctiveActionDays).toBe(60);
    expect(FINDING_TYPE_META.minor_nc.correctiveActionDays).toBe(90);
    expect(FINDING_TYPE_META.ofi.correctiveActionDays).toBeNull();
    expect(FINDING_TYPE_META.strong_point.correctiveActionDays).toBeNull();
    expect(FINDING_TYPE_META.observation.correctiveActionDays).toBeNull();
  });

  it('uses the §4 audit codes', () => {
    expect(FINDING_TYPE_META.major_nc.code).toBe('MNC');
    expect(FINDING_TYPE_META.minor_nc.code).toBe('NC');
    expect(FINDING_TYPE_META.ofi.code).toBe('OFI');
    expect(FINDING_TYPE_META.strong_point.code).toBe('SP');
    expect(FINDING_TYPE_META.observation.code).toBe('OBS');
  });

  it('uses the §14 semantic finding colors', () => {
    expect(FINDING_TYPE_META.major_nc.colorHex).toBe('#C0392B');
    expect(FINDING_TYPE_META.minor_nc.colorHex).toBe('#E67E22');
    expect(FINDING_TYPE_META.ofi.colorHex).toBe('#2980B9');
    expect(FINDING_TYPE_META.strong_point.colorHex).toBe('#8E44AD');
  });

  it('gives every type a non-empty label and description', () => {
    for (const type of FINDING_TYPES) {
      expect(FINDING_TYPE_META[type].label.length).toBeGreaterThan(0);
      expect(FINDING_TYPE_META[type].description.length).toBeGreaterThan(0);
    }
  });

  it('uses valid 6-digit hex colors', () => {
    for (const type of FINDING_TYPES) {
      expect(FINDING_TYPE_META[type].colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('CONFORMITY_STATUS_META', () => {
  it('defines metadata for every conformity status', () => {
    for (const status of CONFORMITY_STATUSES) {
      expect(CONFORMITY_STATUS_META[status]).toBeDefined();
      expect(CONFORMITY_STATUS_META[status].label.length).toBeGreaterThan(0);
    }
  });

  it('colors conforming green per §14', () => {
    expect(CONFORMITY_STATUS_META.conforming.colorHex).toBe('#2D9E2D');
  });

  it('uses valid 6-digit hex colors', () => {
    for (const status of CONFORMITY_STATUSES) {
      expect(CONFORMITY_STATUS_META[status].colorHex).toMatch(
        /^#[0-9A-Fa-f]{6}$/,
      );
    }
  });
});
