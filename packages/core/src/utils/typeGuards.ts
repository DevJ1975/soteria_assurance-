import type { Finding, FindingType } from '../types/finding';
import type { ClauseAssessment } from '../types/clause';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const FINDING_TYPES: readonly FindingType[] = [
  'major_nc',
  'minor_nc',
  'ofi',
  'strong_point',
  'observation',
];

/**
 * Narrows an unknown value to a {@link Finding} using a structural check of
 * its discriminating fields.
 */
export function isFinding(value: unknown): value is Finding {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.findingNumber === 'string' &&
    typeof value.clauseNumber === 'string' &&
    typeof value.type === 'string' &&
    FINDING_TYPES.includes(value.type as FindingType)
  );
}

/**
 * Returns `true` when `finding` is a major nonconformity.
 */
export function isMajorNonconformity(finding: Finding): boolean {
  return finding.type === 'major_nc';
}

/**
 * Returns `true` when `finding` is a nonconformity (major or minor).
 */
export function isNonconformity(finding: Finding): boolean {
  return finding.type === 'major_nc' || finding.type === 'minor_nc';
}

/**
 * Narrows an unknown value to a {@link ClauseAssessment} using a structural
 * check of its discriminating fields.
 */
export function isClauseAssessment(value: unknown): value is ClauseAssessment {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.auditId === 'string' &&
    typeof value.clauseNumber === 'string' &&
    typeof value.conformityStatus === 'string' &&
    typeof value.score === 'number' &&
    Array.isArray(value.subClauseNotes)
  );
}
