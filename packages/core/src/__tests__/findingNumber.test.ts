import {
  generateFindingNumber,
  generateAuditNumber,
  generateCANumber,
} from '../utils/findingNumber';

describe('generateFindingNumber', () => {
  it('zero-pads the sequence to three digits', () => {
    expect(generateFindingNumber('NCR', 2026, 1)).toBe('NCR-2026-001');
    expect(generateFindingNumber('NCR', 2026, 42)).toBe('NCR-2026-042');
    expect(generateFindingNumber('NCR', 2026, 999)).toBe('NCR-2026-999');
  });

  it('does not truncate sequences wider than three digits', () => {
    expect(generateFindingNumber('NCR', 2026, 1000)).toBe('NCR-2026-1000');
  });

  it('trims a trailing dash from a prefix like "NCR-"', () => {
    expect(generateFindingNumber('NCR-', 2026, 7)).toBe('NCR-2026-007');
    expect(generateFindingNumber('NCR---', 2026, 7)).toBe('NCR-2026-007');
  });

  it('trims surrounding whitespace from the prefix', () => {
    expect(generateFindingNumber('  OFI  ', 2026, 3)).toBe('OFI-2026-003');
  });

  it('is deterministic for the same inputs', () => {
    expect(generateFindingNumber('NCR', 2026, 5)).toBe(
      generateFindingNumber('NCR', 2026, 5),
    );
  });

  it('throws on a negative sequence', () => {
    expect(() => generateFindingNumber('NCR', 2026, -1)).toThrow(RangeError);
  });

  it('throws on a non-integer sequence', () => {
    expect(() => generateFindingNumber('NCR', 2026, 1.5)).toThrow(RangeError);
  });

  it('throws on a non-integer year', () => {
    expect(() => generateFindingNumber('NCR', 2026.5, 1)).toThrow(RangeError);
  });

  it('throws on an empty prefix', () => {
    expect(() => generateFindingNumber('', 2026, 1)).toThrow(RangeError);
    expect(() => generateFindingNumber('-', 2026, 1)).toThrow(RangeError);
  });
});

describe('generateAuditNumber', () => {
  it('produces an AUD-prefixed number', () => {
    expect(generateAuditNumber(2026, 1)).toBe('AUD-2026-001');
  });
});

describe('generateCANumber', () => {
  it('produces a CA-prefixed number', () => {
    expect(generateCANumber(2026, 12)).toBe('CA-2026-012');
  });
});
