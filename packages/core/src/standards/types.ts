/**
 * Canonical type definitions for management-system standard datasets.
 *
 * This is the single source of truth for the shape of a clause record and of a
 * standard definition. Mobile, web, backend, and AI agents all consume these
 * types — they must never redeclare clause structure locally.
 *
 * The clause shape is deliberately standard-agnostic: ISO 45001, ISO 14001 and
 * ISO 9001 all follow the Annex SL high-level structure (clauses 4–10 with
 * dotted sub-clauses), so one record type serves every standard we model.
 */

/**
 * Identifier for a management-system standard.
 *
 * The slug — never the display name — is the canonical identifier everywhere:
 * in TypeScript, in the database (`public.standards.id`), and in URLs. Display
 * names are always looked up from the registry so an edition bump is a
 * single-line change.
 */
export type StandardId = 'iso45001' | 'iso14001' | 'iso9001';

/**
 * A single clause or sub-clause of a management-system standard.
 *
 * Requirement text is faithfully PARAPHRASED (never copied verbatim from the
 * published standard) to keep the dataset free of the copyrighted ISO text
 * while preserving the auditable intent of each requirement.
 */
export interface StandardClause {
  /** Dotted clause number, e.g. "4.1", "6.1.2", "8.1.4.1". Unique within a standard. */
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

  /**
   * Other clause numbers that genuinely interact with or inform this clause.
   * References are always within the same standard.
   */
  crossReferences: string[];
}

/**
 * @deprecated Use {@link StandardClause}. Retained so existing ISO 45001
 * consumers keep compiling while they migrate to the standard-agnostic name.
 */
export type ISO45001Clause = StandardClause;

/**
 * The AI persona fragments that make a prompt specific to one standard.
 *
 * Prompts are composed from these rather than hard-coding a standard's name in
 * template literals, so adding a standard never means editing prompt text.
 */
export interface StandardPromptProfile {
  /** The AI co-pilot persona name presented to auditors, e.g. "ARIA". */
  personaName: string;

  /** Domain expertise claims for the system prompt, one bullet per entry. */
  expertiseLines: string[];

  /** Sibling/related standards an auditor of this standard is expected to know. */
  relatedStandards: string[];

  /** Risk-assessment methodologies idiomatic to this discipline. */
  riskMethodologies: string[];
}

/**
 * A management-system standard the platform knows about.
 *
 * A standard may be registered before it is built: `isAvailable: false` with an
 * empty `clauses` array marks a roadmap placeholder. Every helper and UI
 * surface handles that state, so shipping the standard later is data entry in
 * `<standardId>/clauses.ts` plus flipping `isAvailable` — no refactor.
 */
export interface StandardDefinition {
  /** Canonical slug, matching `public.standards.id`. */
  id: StandardId;

  /** Display name including edition, e.g. "ISO 45001:2018". */
  name: string;

  /** Short name for chips, nav labels and badges, e.g. "ISO 45001". */
  shortName: string;

  /** Edition year of the published standard, e.g. "2018". */
  edition: string;

  /** Management-system discipline, e.g. "Occupational Health & Safety". */
  discipline: string;

  /**
   * Whether the standard is built and selectable. `false` means the standard is
   * registered as a roadmap placeholder and the UI shows a "coming soon" state.
   */
  isAvailable: boolean;

  /** The clause dataset. Empty for a standard that has not been authored yet. */
  clauses: StandardClause[];

  /** Top-level clause groups this standard is expected to define, e.g. 4–10. */
  topLevelNumbers: string[];

  /** Per-standard AI persona fragments used to compose prompts. */
  prompt: StandardPromptProfile;
}
