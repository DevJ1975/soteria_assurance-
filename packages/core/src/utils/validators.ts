import type { Finding, FindingType } from '../types/finding';
import { FINDING_TYPE_META } from '../constants/findingTypes';

/**
 * Matches ISO 45001 dotted clause numbers such as `4`, `6.1`, `8.1.4.2`.
 *
 * Each segment is a positive integer with no leading zeros; segments are
 * separated by single dots, with no leading/trailing dot.
 */
const CLAUSE_NUMBER_REGEX = /^[1-9]\d*(?:\.[1-9]\d*)*$/;

/**
 * Pragmatic RFC-5322-lite email validation. Rejects whitespace, requires a
 * single `@`, a dotted domain and a TLD of at least two characters.
 */
const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Returns `true` when `value` is a well-formed ISO 45001 clause number.
 */
export function isValidClauseNumber(value: string): boolean {
  return CLAUSE_NUMBER_REGEX.test(value.trim());
}

/**
 * Returns `true` when `value` looks like a valid email address.
 */
export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/** A single validation error for a draft finding. */
export interface ValidationError {
  field: string;
  message: string;
}

/** The result of validating a draft finding. */
export interface FindingValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const FINDING_TYPES = Object.keys(FINDING_TYPE_META) as FindingType[];

function isFindingType(value: unknown): value is FindingType {
  return typeof value === 'string' && FINDING_TYPES.includes(value as FindingType);
}

/**
 * Validates a partial {@link Finding} draft before it is persisted.
 *
 * Checks the minimum fields required to raise a finding: a recognised type,
 * a valid clause number, a non-empty title and objective evidence, and — for
 * nonconformities — a matching `severity`.
 */
export function validateFindingDraft(
  draft: Partial<Finding>,
): FindingValidationResult {
  const errors: ValidationError[] = [];

  if (!isFindingType(draft.type)) {
    errors.push({ field: 'type', message: 'A valid finding type is required.' });
  }

  if (!draft.clauseNumber || !isValidClauseNumber(draft.clauseNumber)) {
    errors.push({
      field: 'clauseNumber',
      message: 'A valid ISO 45001 clause number is required (e.g. "6.1.2").',
    });
  }

  if (!draft.title || draft.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'A finding title is required.' });
  }

  if (!draft.objectiveEvidence || draft.objectiveEvidence.trim().length === 0) {
    errors.push({
      field: 'objectiveEvidence',
      message: 'Objective evidence is required to raise a finding.',
    });
  }

  // Nonconformities must carry a matching severity.
  if (draft.type === 'major_nc' && draft.severity !== 'major') {
    errors.push({
      field: 'severity',
      message: 'A major nonconformity must have severity "major".',
    });
  }
  if (draft.type === 'minor_nc' && draft.severity !== 'minor') {
    errors.push({
      field: 'severity',
      message: 'A minor nonconformity must have severity "minor".',
    });
  }

  return { valid: errors.length === 0, errors };
}
