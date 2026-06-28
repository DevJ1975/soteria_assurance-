import type { FindingType } from '../types/finding';
import type { ConformityStatus } from '../types/clause';

/**
 * Metadata for a single finding type.
 */
export interface FindingTypeMeta {
  /** Short audit code, e.g. "MNC". */
  code: string;
  /** Human-readable label. */
  label: string;
  /** Description of what the type means. */
  description: string;
  /** Semantic color (DESIGN_DOC §14). */
  colorHex: string;
  /**
   * Mandatory corrective-action window in calendar days, or `null` when no
   * corrective action is required (DESIGN_DOC §4).
   */
  correctiveActionDays: number | null;
}

/**
 * Canonical metadata for every finding type (DESIGN_DOC §4 + §14).
 *
 * - Major NC (MNC): red `#C0392B`, 60-day corrective action.
 * - Minor NC (NC): orange `#E67E22`, 90-day corrective action.
 * - OFI: blue `#2980B9`, no mandatory corrective action.
 * - Strong Point (SP): purple `#8E44AD`, none.
 * - Observation (OBS): no mandatory corrective action.
 */
export const FINDING_TYPE_META: Record<FindingType, FindingTypeMeta> = {
  major_nc: {
    code: 'MNC',
    label: 'Major Nonconformity',
    description:
      'Absence of or failure to implement and maintain one or more OH&S management system requirements, or a situation that raises significant doubt about the capability of the OH&S system to achieve its intended outcome.',
    colorHex: '#C0392B',
    correctiveActionDays: 60,
  },
  minor_nc: {
    code: 'NC',
    label: 'Minor Nonconformity',
    description:
      'A single observed lapse in the fulfillment of a requirement of the OH&S management system.',
    colorHex: '#E67E22',
    correctiveActionDays: 90,
  },
  ofi: {
    code: 'OFI',
    label: 'Opportunity for Improvement',
    description:
      'Observation that could enhance system effectiveness but does not constitute a nonconformity.',
    colorHex: '#2980B9',
    correctiveActionDays: null,
  },
  strong_point: {
    code: 'SP',
    label: 'Strong Point',
    description:
      'Evidence of exceptional implementation exceeding standard requirements.',
    colorHex: '#8E44AD',
    correctiveActionDays: null,
  },
  observation: {
    code: 'OBS',
    label: 'Observation',
    description: 'General audit note for informational purposes.',
    // Observations share the neutral muted tone; no dedicated semantic color
    // is defined in DESIGN_DOC §14, so we use the secondary text neutral.
    colorHex: '#6B7280',
    correctiveActionDays: null,
  },
};

/**
 * Metadata for a clause-level conformity status.
 */
export interface ConformityStatusMeta {
  label: string;
  description: string;
  colorHex: string;
}

/**
 * Canonical metadata for every conformity status (colors from DESIGN_DOC §14).
 */
export const CONFORMITY_STATUS_META: Record<
  ConformityStatus,
  ConformityStatusMeta
> = {
  conforming: {
    label: 'Conforming',
    description: 'The clause requirements are met.',
    colorHex: '#2D9E2D',
  },
  major_nc: {
    label: 'Major Nonconformity',
    description: 'A major nonconformity was raised against this clause.',
    colorHex: '#C0392B',
  },
  minor_nc: {
    label: 'Minor Nonconformity',
    description: 'A minor nonconformity was raised against this clause.',
    colorHex: '#E67E22',
  },
  not_audited: {
    label: 'Not Audited',
    description: 'This clause has not yet been assessed.',
    colorHex: '#9CA3AF',
  },
  not_applicable: {
    label: 'Not Applicable',
    description: 'This clause is out of scope for the audit.',
    colorHex: '#6B7280',
  },
};
