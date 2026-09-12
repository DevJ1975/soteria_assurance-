import type { StandardClause } from '../types';

/**
 * ISO 9001:2015 clause dataset — PLACEHOLDER.
 *
 * Intentionally empty. ISO 9001 is registered as a roadmap standard so that
 * every type, helper, database row, and UI surface already accounts for it;
 * shipping it means authoring the clause records here and flipping
 * `isAvailable` to `true` in `../iso9001/index.ts`. No refactor, no migration,
 * no UI change is required at that point.
 *
 * Authoring notes for whoever fills this in:
 * - Follow the Annex SL structure: top-level groups 4–10, dotted sub-clauses.
 * - `requirementText` MUST be paraphrased, never copied from the published
 *   standard (see the ISO 45001 dataset for the house style).
 * - Every entry in `crossReferences` must resolve to another clause in THIS
 *   array — the dataset-integrity test enforces this the moment the standard
 *   becomes available.
 * - Populate all five string arrays; empty ones fail the integrity test.
 */
export const ISO9001_CLAUSES: StandardClause[] = [];
