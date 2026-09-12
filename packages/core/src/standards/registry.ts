import type { StandardDefinition, StandardId } from './types';
import { ISO45001 } from './iso45001';
import { ISO14001 } from './iso14001';
import { ISO9001 } from './iso9001';

/**
 * Every management-system standard the platform knows about, keyed by slug.
 *
 * Registration is not the same as availability: ISO 14001 and ISO 9001 are
 * registered roadmap placeholders (`isAvailable: false`, empty clause arrays).
 * They are deliberately visible to the UI so the roadmap is legible in the
 * product, but they are not selectable until their datasets are authored.
 *
 * This registry is the client-side source of truth for standard metadata. The
 * `public.standards` table exists for referential integrity on `standard_id`
 * columns; the two must agree, which `scripts/seed-demo.mjs` asserts.
 */
export const STANDARDS: Readonly<Record<StandardId, StandardDefinition>> = Object.freeze({
  iso45001: ISO45001,
  iso14001: ISO14001,
  iso9001: ISO9001,
});

/**
 * Display order for pickers and nav — available standards first, then roadmap
 * placeholders, so the selectable options are never buried.
 */
const STANDARD_ORDER: readonly StandardId[] = ['iso45001', 'iso14001', 'iso9001'];

/**
 * The standard assumed wherever no audit context supplies one (the wiki's
 * initial selection, offline records written before the standard dimension
 * existed, seed data).
 */
export const DEFAULT_STANDARD_ID: StandardId = 'iso45001';

/** Returns the definition for a standard id. */
export function getStandard(id: StandardId): StandardDefinition {
  return STANDARDS[id];
}

/** Returns every registered standard, including roadmap placeholders, in display order. */
export function listStandards(): StandardDefinition[] {
  return STANDARD_ORDER.map((id) => STANDARDS[id]);
}

/** Returns only the standards that are built and selectable, in display order. */
export function listAvailableStandards(): StandardDefinition[] {
  return listStandards().filter((standard) => standard.isAvailable);
}

/** Type guard narrowing an arbitrary string to a known standard id. */
export function isStandardId(value: string): value is StandardId {
  return Object.prototype.hasOwnProperty.call(STANDARDS, value);
}

/**
 * Whether a standard is built and selectable. A registered-but-unavailable
 * standard is a roadmap placeholder and should render a "coming soon" state.
 */
export function isStandardAvailable(id: StandardId): boolean {
  return STANDARDS[id].isAvailable;
}
