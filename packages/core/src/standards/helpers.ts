import type { StandardClause, StandardId } from './types';
import { getStandard } from './registry';

/**
 * A node in a nested clause tree, pairing a clause with its (recursively
 * nested) child clauses.
 */
export interface StandardClauseTreeNode {
  clause: StandardClause;
  children: StandardClauseTreeNode[];
}

/**
 * @deprecated Use {@link StandardClauseTreeNode}. Retained so existing ISO
 * 45001 consumers keep compiling while they migrate to the standard-agnostic
 * name.
 */
export type ISO45001ClauseTreeNode = StandardClauseTreeNode;

/**
 * Per-standard clause indexes for O(1) lookups, built lazily on first use and
 * memoized. Lazy rather than eager so registering a standard costs nothing
 * until something actually reads its clauses — which matters on mobile, where
 * a screen typically touches one standard.
 */
const CLAUSE_INDEXES = new Map<StandardId, ReadonlyMap<string, StandardClause>>();

function clauseIndex(standardId: StandardId): ReadonlyMap<string, StandardClause> {
  const cached = CLAUSE_INDEXES.get(standardId);
  if (cached !== undefined) {
    return cached;
  }

  const index: ReadonlyMap<string, StandardClause> = new Map(
    getStandard(standardId).clauses.map((clause) => [clause.number, clause]),
  );
  CLAUSE_INDEXES.set(standardId, index);
  return index;
}

/**
 * Every helper below takes the standard as an explicit first argument with no
 * default. That is deliberate: it makes `tsc` flag any call site that has not
 * decided which standard it is asking about, and it means a standard whose
 * dataset is still empty simply returns empty results rather than throwing.
 */

/**
 * Returns the clause with the given dotted number within a standard, or
 * `undefined` if no such clause exists (including when the standard's dataset
 * has not been authored yet).
 */
export function getClauseByNumber(
  standardId: StandardId,
  number: string,
): StandardClause | undefined {
  return clauseIndex(standardId).get(number);
}

/**
 * Returns the direct child clauses of the clause with the given number, in
 * dataset order. Returns an empty array if the clause has no children or does
 * not exist.
 */
export function getChildClauses(standardId: StandardId, number: string): StandardClause[] {
  return getStandard(standardId).clauses.filter((clause) => clause.parentNumber === number);
}

/**
 * Returns the top-level clause groups (4–10), i.e. clauses with no parent.
 */
export function getTopLevelClauses(standardId: StandardId): StandardClause[] {
  return getStandard(standardId).clauses.filter((clause) => clause.parentNumber === undefined);
}

/**
 * Returns every clause in the standard's dataset as a flat array (a defensive
 * shallow copy so callers cannot mutate the canonical dataset ordering).
 */
export function flattenClauses(standardId: StandardId): StandardClause[] {
  return [...getStandard(standardId).clauses];
}

/**
 * Builds and returns the full nested clause tree, rooted at the top-level
 * clause groups. Children at every level are ordered as they appear in the
 * dataset. Returns an empty array for a standard with no clause data yet.
 */
export function getClauseTree(standardId: StandardId): StandardClauseTreeNode[] {
  const buildNode = (clause: StandardClause): StandardClauseTreeNode => ({
    clause,
    children: getChildClauses(standardId, clause.number).map(buildNode),
  });

  return getTopLevelClauses(standardId).map(buildNode);
}

/**
 * Returns the ancestor clauses of the clause with the given number, ordered
 * from the immediate parent up to the top-level group. Returns an empty array
 * if the clause does not exist or has no parent.
 */
export function getAncestors(standardId: StandardId, number: string): StandardClause[] {
  const index = clauseIndex(standardId);
  const ancestors: StandardClause[] = [];
  let current = index.get(number);

  while (current?.parentNumber !== undefined) {
    const parent = index.get(current.parentNumber);
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
export function getRelatedClauses(standardId: StandardId, number: string): StandardClause[] {
  const index = clauseIndex(standardId);
  const clause = index.get(number);
  if (clause === undefined) {
    return [];
  }

  const related: StandardClause[] = [];
  for (const ref of clause.crossReferences) {
    const target = index.get(ref);
    if (target !== undefined) {
      related.push(target);
    }
  }
  return related;
}
