/**
 * Pure parser turning Claude's free-text NCR draft into the structured
 * {@link NCRDraftResponse} contract from `@soteria/core`.
 *
 * Kept pure (no I/O) so it is fully unit-testable. The model is prompted to
 * emit labelled sections (REQUIREMENT / FINDING / OBJECTIVE EVIDENCE / etc.);
 * this parser extracts each section defensively and never throws.
 *
 * @packageDocumentation
 */

import type { NCRDraftResponse } from '@soteria/core';

/**
 * Extracts the text following a labelled heading until the next known heading
 * or end of string. Case-insensitive; tolerates `:` or newline separators.
 */
function extractSection(text: string, labels: string[]): string {
  const allHeadings = [
    'NCR TITLE',
    'TITLE',
    'REQUIREMENT',
    'FINDING',
    'OBJECTIVE EVIDENCE',
    'RECOMMENDED SEVERITY',
    'SEVERITY',
    'JUSTIFICATION',
    'RELATED CLAUSES',
  ];

  for (const label of labels) {
    // Build a stop-list of every OTHER heading so we capture up to the next one.
    const others = allHeadings
      .filter((h) => h !== label)
      .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?:^|\\n)\\s*\\d*\\.?\\s*${escaped}\\s*[:\\-]?\\s*([\\s\\S]*?)(?=\\n\\s*\\d*\\.?\\s*(?:${others})\\s*[:\\-]|$)`,
      'i',
    );
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * Pulls ISO clause references (e.g. "6.1.2", "Clause 8.1.2.b") out of a string.
 */
export function extractClauseReferences(text: string): string[] {
  // Matches "6.1.2", "8.1.2.b" and "Clause 7.4.1" — an optional trailing
  // sub-clause letter may be joined directly or via a dot (e.g. "6.1.2.b").
  const matches = text.match(/\b\d+(?:\.\d+)+(?:\.?[a-z])?\b/gi) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

/**
 * Determines suggested severity from the model's severity section.
 * Defaults to `minor` when ambiguous (the conservative choice — a minor NC is
 * less consequential to over-call than a major).
 */
function parseSeverity(severitySection: string): 'major' | 'minor' {
  return /\bmajor\b/i.test(severitySection) ? 'major' : 'minor';
}

/**
 * Parses raw Claude output into a structured {@link NCRDraftResponse}.
 *
 * Never throws: missing sections fall back to empty strings / sensible
 * defaults so the auditor always receives a usable (if partial) draft.
 */
export function parseNCRResponse(raw: string): NCRDraftResponse {
  const text = raw.trim();

  const ncrTitle = extractSection(text, ['NCR TITLE', 'TITLE']);
  const requirementStatement = extractSection(text, ['REQUIREMENT']);
  const findingStatement = extractSection(text, ['FINDING']);
  const objectiveEvidenceStatement = extractSection(text, ['OBJECTIVE EVIDENCE']);
  const severitySection = extractSection(text, ['RECOMMENDED SEVERITY', 'SEVERITY']);
  const explicitJustification = extractSection(text, ['JUSTIFICATION']);
  const relatedSection = extractSection(text, ['RELATED CLAUSES']);

  const suggestedSeverity = parseSeverity(severitySection);
  const severityJustification =
    explicitJustification.length > 0 ? explicitJustification : severitySection;
  const relatedClauses = extractClauseReferences(relatedSection);

  return {
    ncrTitle,
    requirementStatement,
    findingStatement,
    objectiveEvidenceStatement,
    suggestedSeverity,
    severityJustification,
    relatedClauses,
  };
}
