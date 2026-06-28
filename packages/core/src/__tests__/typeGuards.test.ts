import {
  isFinding,
  isMajorNonconformity,
  isNonconformity,
  isClauseAssessment,
} from '../utils/typeGuards';
import { makeFinding, makeClauseAssessment } from './testHelpers';

describe('isFinding', () => {
  it('accepts a well-formed finding', () => {
    expect(isFinding(makeFinding())).toBe(true);
  });

  it.each([null, undefined, 42, 'finding', []])(
    'rejects non-object value %p',
    (value) => {
      expect(isFinding(value)).toBe(false);
    },
  );

  it('rejects an object missing the type field', () => {
    const { type: _omit, ...rest } = makeFinding();
    expect(isFinding(rest)).toBe(false);
  });

  it('rejects an object with an unknown finding type', () => {
    expect(isFinding({ ...makeFinding(), type: 'bogus' })).toBe(false);
  });
});

describe('isMajorNonconformity', () => {
  it('is true only for major_nc', () => {
    expect(isMajorNonconformity(makeFinding({ type: 'major_nc' }))).toBe(true);
    expect(isMajorNonconformity(makeFinding({ type: 'minor_nc' }))).toBe(false);
    expect(isMajorNonconformity(makeFinding({ type: 'ofi' }))).toBe(false);
  });
});

describe('isNonconformity', () => {
  it('is true for major and minor NCs', () => {
    expect(isNonconformity(makeFinding({ type: 'major_nc' }))).toBe(true);
    expect(isNonconformity(makeFinding({ type: 'minor_nc' }))).toBe(true);
  });

  it('is false for OFI, strong point and observation', () => {
    expect(isNonconformity(makeFinding({ type: 'ofi' }))).toBe(false);
    expect(isNonconformity(makeFinding({ type: 'strong_point' }))).toBe(false);
    expect(isNonconformity(makeFinding({ type: 'observation' }))).toBe(false);
  });
});

describe('isClauseAssessment', () => {
  it('accepts a well-formed clause assessment', () => {
    expect(isClauseAssessment(makeClauseAssessment())).toBe(true);
  });

  it.each([null, undefined, 0, 'clause'])(
    'rejects non-object value %p',
    (value) => {
      expect(isClauseAssessment(value)).toBe(false);
    },
  );

  it('rejects an object missing subClauseNotes', () => {
    const { subClauseNotes: _omit, ...rest } = makeClauseAssessment();
    expect(isClauseAssessment(rest)).toBe(false);
  });

  it('rejects an object whose score is not a number', () => {
    expect(
      isClauseAssessment({ ...makeClauseAssessment(), score: '100' }),
    ).toBe(false);
  });
});
