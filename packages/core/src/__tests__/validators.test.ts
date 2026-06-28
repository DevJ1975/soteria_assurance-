import {
  isValidClauseNumber,
  isValidEmail,
  validateFindingDraft,
} from '../utils/validators';
import { makeFinding } from './testHelpers';

describe('isValidClauseNumber', () => {
  it.each(['4', '6.1', '6.1.2', '8.1.4.2', '9.2.1', '10'])(
    'accepts valid clause number "%s"',
    (value) => {
      expect(isValidClauseNumber(value)).toBe(true);
    },
  );

  it('trims surrounding whitespace', () => {
    expect(isValidClauseNumber('  6.1.2  ')).toBe(true);
  });

  it.each(['', '0', '6.', '.6', '6..1', '6.0', '01.2', 'a.b', '6.1.2.'])(
    'rejects invalid clause number "%s"',
    (value) => {
      expect(isValidClauseNumber(value)).toBe(false);
    },
  );
});

describe('isValidEmail', () => {
  it.each(['jamil@trainovations.com', 'a.b+tag@sub.example.co'])(
    'accepts valid email "%s"',
    (value) => {
      expect(isValidEmail(value)).toBe(true);
    },
  );

  it.each(['', 'no-at', 'a@b', 'a@b.c', 'a b@c.com', 'a@@b.com'])(
    'rejects invalid email "%s"',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});

describe('validateFindingDraft', () => {
  it('accepts a complete minor nonconformity draft', () => {
    const draft = makeFinding({ type: 'minor_nc', severity: 'minor' });
    const result = validateFindingDraft(draft);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a complete major nonconformity draft', () => {
    const draft = makeFinding({ type: 'major_nc', severity: 'major' });
    expect(validateFindingDraft(draft).valid).toBe(true);
  });

  it('accepts an OFI without severity', () => {
    const draft = makeFinding({ type: 'ofi', severity: undefined });
    expect(validateFindingDraft(draft).valid).toBe(true);
  });

  it('rejects an unrecognised type', () => {
    const result = validateFindingDraft({ type: undefined });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'type')).toBe(true);
  });

  it('rejects an invalid clause number', () => {
    const draft = makeFinding({ clauseNumber: 'not-a-clause' });
    const result = validateFindingDraft(draft);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'clauseNumber')).toBe(true);
  });

  it('rejects a blank title', () => {
    const draft = makeFinding({ title: '   ' });
    const result = validateFindingDraft(draft);
    expect(result.errors.some((e) => e.field === 'title')).toBe(true);
  });

  it('rejects missing objective evidence', () => {
    const draft = makeFinding({ objectiveEvidence: '' });
    const result = validateFindingDraft(draft);
    expect(result.errors.some((e) => e.field === 'objectiveEvidence')).toBe(true);
  });

  it('rejects a major NC whose severity is not "major"', () => {
    const draft = makeFinding({ type: 'major_nc', severity: 'minor' });
    const result = validateFindingDraft(draft);
    expect(result.errors.some((e) => e.field === 'severity')).toBe(true);
  });

  it('rejects a minor NC whose severity is not "minor"', () => {
    const draft = makeFinding({ type: 'minor_nc', severity: undefined });
    const result = validateFindingDraft(draft);
    expect(result.errors.some((e) => e.field === 'severity')).toBe(true);
  });

  it('accumulates multiple errors on an empty draft', () => {
    const result = validateFindingDraft({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
