/**
 * Deterministic, pure identifier generators for audits, findings and
 * corrective actions.
 */

const DEFAULT_PAD_WIDTH = 3;

/**
 * Zero-pads `seq` to at least `width` digits.
 *
 * @throws RangeError if `seq` is negative or not an integer.
 */
function padSequence(seq: number, width: number = DEFAULT_PAD_WIDTH): string {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new RangeError(`Sequence must be a non-negative integer, got: ${seq}`);
  }
  return String(seq).padStart(width, '0');
}

/**
 * Generates a finding number such as `NCR-2026-001`.
 *
 * @param prefix - The finding prefix, e.g. `"NCR"` (a trailing `-` is trimmed).
 * @param year   - Four-digit year.
 * @param seq    - Non-negative sequence number, zero-padded to 3 digits.
 */
export function generateFindingNumber(
  prefix: string,
  year: number,
  seq: number,
): string {
  const cleanPrefix = prefix.trim().replace(/-+$/, '');
  if (cleanPrefix.length === 0) {
    throw new RangeError('Prefix must be a non-empty string.');
  }
  if (!Number.isInteger(year)) {
    throw new RangeError(`Year must be an integer, got: ${year}`);
  }
  return `${cleanPrefix}-${year}-${padSequence(seq)}`;
}

/**
 * Generates an audit number such as `AUD-2026-001`.
 */
export function generateAuditNumber(year: number, seq: number): string {
  return generateFindingNumber('AUD', year, seq);
}

/**
 * Generates a corrective-action number such as `CA-2026-001`.
 */
export function generateCANumber(year: number, seq: number): string {
  return generateFindingNumber('CA', year, seq);
}
