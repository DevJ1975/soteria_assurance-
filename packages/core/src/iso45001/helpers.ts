import type { ISO45001Clause } from './types';
import { ISO45001_CLAUSES } from './clauses';

/**
 * A node in the nested ISO 45001 clause tree, pairing a clause with its
 * (recursively nested) child clauses.
 */
export interface ISO45001ClauseTreeNode {
  clause: ISO45001Clause;
  children: ISO45001ClauseTreeNode[];
}

/**
 * Index of clauses by their dotted number for O(1) lookups. Built once at
 * module load since the dataset is static.
 */
const CLAUSE_INDEX: ReadonlyMap<string, ISO45001Clause> = new Map(
  ISO45001_CLAUSES.map((clause) => [clause.number, clause]),
);

/**
 * Returns the clause with the given dotted number, or `undefined` if no such
 * clause exists in the dataset.
 */
export function getClauseByNumber(number: string): ISO45001Clause | undefined {
  return CLAUSE_INDEX.get(number);
}

/**
 * Returns the direct child clauses of the clause with the given number, in
 * dataset order. Returns an empty array if the clause has no children or does
 * not exist.
 */
export function getChildClauses(number: string): ISO45001Clause[] {
  return ISO45001_CLAUSES.filter((clause) => clause.parentNumber === number);
}

/**
 * Returns the top-level clause groups (4–10), i.e. clauses with no parent.
 */
export function getTopLevelClauses(): ISO45001Clause[] {
  return ISO45001_CLAUSES.filter((clause) => clause.parentNumber === undefined);
}

/**
 * Returns every clause in the dataset as a flat array (a defensive shallow
 * copy so callers cannot mutate the canonical dataset ordering).
 */
export function flattenClauses(): ISO45001Clause[] {
  return [...ISO45001_CLAUSES];
}

/**
 * Builds and returns the full nested clause tree, rooted at the top-level
 * clause groups. Children at every level are ordered as they appear in the
 * dataset.
 */
export function getClauseTree(): ISO45001ClauseTreeNode[] {
  const buildNode = (clause: ISO45001Clause): ISO45001ClauseTreeNode => ({
    clause,
    children: getChildClauses(clause.number).map(buildNode),
  });

  return getTopLevelClauses().map(buildNode);
}

/**
 * Returns the ancestor clauses of the clause with the given number, ordered
 * from the immediate parent up to the top-level group. Returns an empty array
 * if the clause does not exist or has no parent.
 */
export function getAncestors(number: string): ISO45001Clause[] {
  const ancestors: ISO45001Clause[] = [];
  let current = CLAUSE_INDEX.get(number);

  while (current?.parentNumber !== undefined) {
    const parent = CLAUSE_INDEX.get(current.parentNumber);
    if (parent === undefined) {
      break;
    }
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * Resolves the `crossReferences` of the clause with the given number into the
 * actual clause objects they point to, in declared order. Cross-references
 * that do not resolve to an existing clause are skipped. Returns an empty
 * array if the clause does not exist.
 */
export function getRelatedClauses(number: string): ISO45001Clause[] {
  const clause = CLAUSE_INDEX.get(number);
  if (clause === undefined) {
    return [];
  }

  const related: ISO45001Clause[] = [];
  for (const ref of clause.crossReferences) {
    const target = CLAUSE_INDEX.get(ref);
    if (target !== undefined) {
      related.push(target);
    }
  }
  return related;
}
