/**
 * Canonical type definitions for the ISO 45001:2018 clause dataset.
 *
 * This is the single source of truth for the shape of an ISO 45001 clause
 * record. Mobile, web, backend, and AI agents all consume these types — they
 * must never redeclare clause structure locally.
 */

/**
 * A single ISO 45001:2018 clause or sub-clause.
 *
 * Requirement text is faithfully PARAPHRASED (never copied verbatim from the
 * published standard) to keep the dataset free of the copyrighted ISO text
 * while preserving the auditable intent of each requirement.
 */
export interface ISO45001Clause {
  /** Dotted clause number, e.g. "4.1", "6.1.2", "8.1.4.1". Unique across the dataset. */
  number: string;

  /** Human-readable clause title. */
  title: string;

  /**
   * The immediate parent clause number, e.g. "6.1.2" -> "6.1", "6.1" -> "6".
   * Omitted for the top-level group clauses (4, 5, 6, 7, 8, 9, 10).
   */
  parentNumber?: string;

  /**
   * Depth in the clause tree, derived from the dotted number:
   * 1 = top group (4–10), 2 = e.g. 6.1, 3 = e.g. 6.1.2, 4 = e.g. 8.1.4.1.
   */
  level: number;

  /** Paraphrased statement of what the clause requires (IP-safe, not verbatim ISO text). */
  requirementText: string;

  /** Concrete things an auditor should look for when assessing this clause. */
  auditFocus: string[];

  /** Representative questions an auditor would ask while auditing this clause. */
  typicalAuditQuestions: string[];

  /** Frequently observed nonconformities associated with this clause. */
  commonNonconformities: string[];

  /** Documented information / records typically expected to demonstrate conformity. */
  expectedDocuments: string[];

  /** Other clause numbers that genuinely interact with or inform this clause. */
  crossReferences: string[];
}
