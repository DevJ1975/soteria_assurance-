import type { FindingType, ConformityStatus } from '@soteria/core';

import { SoteriaTokens } from './index';

/**
 * Map every {@link FindingType} to a semantic token color.
 *
 * The values are sourced from {@link SoteriaTokens.colors} so that the design
 * tokens remain the single source of truth for the rendered palette. Each entry
 * is asserted (in tests) to equal the canonical `colorHex` published by
 * `@soteria/core`'s {@link FINDING_TYPE_META}, keeping the two in lock-step:
 *
 * - `major_nc`     → `majorNC`     (#C0392B, red)
 * - `minor_nc`     → `minorNC`     (#E67E22, orange)
 * - `ofi`          → `ofi`         (#2980B9, blue)
 * - `strong_point` → `strongPoint` (#8E44AD, purple)
 * - `observation`  → `textSecondary` (#6B7280, neutral muted — no dedicated
 *   semantic color exists in DESIGN_DOC §14, matching the core metadata)
 */
const FINDING_TYPE_COLOR: Readonly<Record<FindingType, string>> = {
  major_nc: SoteriaTokens.colors.majorNC,
  minor_nc: SoteriaTokens.colors.minorNC,
  ofi: SoteriaTokens.colors.ofi,
  strong_point: SoteriaTokens.colors.strongPoint,
  observation: SoteriaTokens.colors.textSecondary,
};

/**
 * Map every {@link ConformityStatus} to a semantic token color.
 *
 * Mirrors `@soteria/core`'s {@link CONFORMITY_STATUS_META} colors:
 *
 * - `conforming`     → `conforming`    (#2D9E2D, green)
 * - `major_nc`       → `majorNC`       (#C0392B, red)
 * - `minor_nc`       → `minorNC`       (#E67E22, orange)
 * - `not_audited`    → `textMuted`     (#9CA3AF, light neutral)
 * - `not_applicable` → `textSecondary` (#6B7280, neutral)
 */
const CONFORMITY_STATUS_COLOR: Readonly<Record<ConformityStatus, string>> = {
  conforming: SoteriaTokens.colors.conforming,
  major_nc: SoteriaTokens.colors.majorNC,
  minor_nc: SoteriaTokens.colors.minorNC,
  not_audited: SoteriaTokens.colors.textMuted,
  not_applicable: SoteriaTokens.colors.textSecondary,
};

/**
 * Resolve the semantic display color (hex string) for a finding type.
 *
 * @param type - The finding type from `@soteria/core`.
 * @returns A `#RRGGBB` hex string drawn from {@link SoteriaTokens}.
 */
export function getFindingColor(type: FindingType): string {
  return FINDING_TYPE_COLOR[type];
}

/**
 * Resolve the semantic display color (hex string) for a clause conformity
 * status.
 *
 * @param status - The conformity status from `@soteria/core`.
 * @returns A `#RRGGBB` hex string drawn from {@link SoteriaTokens}.
 */
export function getConformityColor(status: ConformityStatus): string {
  return CONFORMITY_STATUS_COLOR[status];
}
