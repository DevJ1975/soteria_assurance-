import {
  ISO45001_CLAUSES,
  getClauseByNumber,
  getChildClauses,
  getTopLevelClauses,
  flattenClauses,
  getClauseTree,
  getAncestors,
  getRelatedClauses,
} from '../iso45001';
import type { ISO45001Clause, ISO45001ClauseTreeNode } from '../iso45001';

/** The seven top-level clause groups of ISO 45001:2018. */
const TOP_LEVEL_NUMBERS = ['4', '5', '6', '7', '8', '9', '10'];

/** Derive the expected depth (level) from a dotted clause number. */
const expectedLevel = (number: string): number => {
  if (TOP_LEVEL_NUMBERS.includes(number)) {
    return 1;
  }
  return number.split('.').length;
};

/** Derive the expected immediate parent number from a dotted clause number. */
const expectedParent = (number: string): string | undefined => {
  if (TOP_LEVEL_NUMBERS.includes(number)) {
    return undefined;
  }
  const parts = number.split('.');
  parts.pop();
  return parts.join('.');
};

describe('ISO45001_CLAUSES dataset integrity', () => {
  it('contains a substantial, complete set of clauses', () => {
    expect(ISO45001_CLAUSES.length).toBeGreaterThanOrEqual(45);
  });

  it('has unique clause numbers', () => {
    const numbers = ISO45001_CLAUSES.map((c) => c.number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(numbers.length);
  });

  it('includes all ten clause groups (4 through 10)', () => {
    for (const group of TOP_LEVEL_NUMBERS) {
      expect(getClauseByNumber(group)).toBeDefined();
    }
    // Exactly seven top-level groups, no more, no fewer.
    expect(getTopLevelClauses().map((c) => c.number).sort()).toEqual(
      [...TOP_LEVEL_NUMBERS].sort(),
    );
  });

  it('resolves every non-top-level parentNumber to an existing clause', () => {
    for (const clause of ISO45001_CLAUSES) {
      if (clause.parentNumber === undefined) {
        expect(TOP_LEVEL_NUMBERS).toContain(clause.number);
      } else {
        expect(getClauseByNumber(clause.parentNumber)).toBeDefined();
      }
    }
  });

  it('assigns parentNumber matching the dotted-number hierarchy', () => {
    for (const clause of ISO45001_CLAUSES) {
      expect(clause.parentNumber).toBe(expectedParent(clause.number));
    }
  });

  it('assigns level matching the dotted depth', () => {
    for (const clause of ISO45001_CLAUSES) {
      expect(clause.level).toBe(expectedLevel(clause.number));
    }
  });

  it('covers the required deep sub-clauses from the standard structure', () => {
    const required = [
      '6.1.1',
      '6.1.2',
      '6.1.3',
      '6.1.4',
      '6.2.1',
      '6.2.2',
      '7.5.1',
      '7.5.2',
      '7.5.3',
      '8.1.1',
      '8.1.2',
      '8.1.3',
      '8.1.4',
      '8.1.4.1',
      '8.1.4.2',
      '8.1.4.3',
      '8.2',
      '9.1.1',
      '9.1.2',
      '9.2.1',
      '9.2.2',
      '9.3.1',
      '9.3.2',
      '9.3.3',
      '10.1',
      '10.2',
      '10.3',
    ];
    for (const number of required) {
      expect(getClauseByNumber(number)).toBeDefined();
    }
  });

  it('has a level-4 clause exactly for the procurement grandchildren', () => {
    const levelFour = ISO45001_CLAUSES.filter((c) => c.level === 4).map((c) => c.number);
    expect(levelFour.sort()).toEqual(['8.1.4.1', '8.1.4.2', '8.1.4.3']);
  });
});

describe('ISO45001_CLAUSES content requirements', () => {
  const nonEmptyStringArray = (value: string[]): boolean =>
    Array.isArray(value) && value.length > 0 && value.every((s) => s.trim().length > 0);

  it('has non-empty requirementText for every clause', () => {
    for (const clause of ISO45001_CLAUSES) {
      expect(clause.requirementText.trim().length).toBeGreaterThan(0);
      expect(clause.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('has non-empty required string arrays for every clause', () => {
    for (const clause of ISO45001_CLAUSES) {
      expect(nonEmptyStringArray(clause.auditFocus)).toBe(true);
      expect(nonEmptyStringArray(clause.typicalAuditQuestions)).toBe(true);
      expect(nonEmptyStringArray(clause.commonNonconformities)).toBe(true);
      expect(nonEmptyStringArray(clause.expectedDocuments)).toBe(true);
      expect(nonEmptyStringArray(clause.crossReferences)).toBe(true);
    }
  });

  it('points every crossReference to a valid, existing clause number', () => {
    for (const clause of ISO45001_CLAUSES) {
      for (const ref of clause.crossReferences) {
        expect(getClauseByNumber(ref)).toBeDefined();
      }
    }
  });

  it('never cross-references a clause to itself', () => {
    for (const clause of ISO45001_CLAUSES) {
      expect(clause.crossReferences).not.toContain(clause.number);
    }
  });
});

describe('getClauseByNumber', () => {
  it('returns the matching clause', () => {
    const clause = getClauseByNumber('6.1.2');
    expect(clause).toBeDefined();
    expect(clause?.title).toBe('Hazard identification and assessment of OH&S risks');
    expect(clause?.parentNumber).toBe('6.1');
    expect(clause?.level).toBe(3);
  });

  it('returns undefined for an unknown clause number', () => {
    expect(getClauseByNumber('99.9')).toBeUndefined();
    expect(getClauseByNumber('')).toBeUndefined();
  });
});

describe('getChildClauses', () => {
  it('returns the direct children of a clause', () => {
    const children = getChildClauses('6.1').map((c) => c.number);
    expect(children).toEqual(['6.1.1', '6.1.2', '6.1.3', '6.1.4']);
  });

  it('returns the direct children of a top-level group', () => {
    const children = getChildClauses('10').map((c) => c.number);
    expect(children).toEqual(['10.1', '10.2', '10.3']);
  });

  it('returns an empty array for a leaf clause', () => {
    expect(getChildClauses('8.1.4.1')).toEqual([]);
  });

  it('returns an empty array for an unknown clause', () => {
    expect(getChildClauses('does-not-exist')).toEqual([]);
  });

  it('does not return grandchildren', () => {
    const children = getChildClauses('8.1').map((c) => c.number);
    expect(children).toContain('8.1.4');
    expect(children).not.toContain('8.1.4.1');
  });
});

describe('getTopLevelClauses', () => {
  it('returns exactly the seven clause groups', () => {
    const numbers = getTopLevelClauses().map((c) => c.number);
    expect(numbers).toEqual(TOP_LEVEL_NUMBERS);
  });

  it('returns only clauses with no parent and level 1', () => {
    for (const clause of getTopLevelClauses()) {
      expect(clause.parentNumber).toBeUndefined();
      expect(clause.level).toBe(1);
    }
  });
});

describe('flattenClauses', () => {
  it('returns all clauses', () => {
    expect(flattenClauses()).toHaveLength(ISO45001_CLAUSES.length);
  });

  it('returns a copy that does not mutate the source dataset', () => {
    const flat = flattenClauses();
    const originalLength = ISO45001_CLAUSES.length;
    flat.pop();
    expect(ISO45001_CLAUSES).toHaveLength(originalLength);
  });
});

describe('getClauseTree', () => {
  it('returns one root node per top-level group', () => {
    const tree = getClauseTree();
    expect(tree.map((node) => node.clause.number)).toEqual(TOP_LEVEL_NUMBERS);
  });

  it('nests children recursively to the correct depth', () => {
    const tree = getClauseTree();
    const clause8 = tree.find((node) => node.clause.number === '8');
    expect(clause8).toBeDefined();

    const clause81 = clause8?.children.find((node) => node.clause.number === '8.1');
    expect(clause81).toBeDefined();

    const clause814 = clause81?.children.find((node) => node.clause.number === '8.1.4');
    expect(clause814).toBeDefined();

    const grandchildren = clause814?.children.map((node) => node.clause.number) ?? [];
    expect(grandchildren).toEqual(['8.1.4.1', '8.1.4.2', '8.1.4.3']);
  });

  it('produces a tree whose total node count equals the dataset size', () => {
    const countNodes = (nodes: ISO45001ClauseTreeNode[]): number =>
      nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
    expect(countNodes(getClauseTree())).toBe(ISO45001_CLAUSES.length);
  });

  it('marks leaf clauses with an empty children array', () => {
    const tree = getClauseTree();
    const clause10 = tree.find((node) => node.clause.number === '10');
    const clause101 = clause10?.children.find((node) => node.clause.number === '10.1');
    expect(clause101?.children).toEqual([]);
  });
});

describe('getAncestors', () => {
  it('returns ancestors from immediate parent up to the top group', () => {
    const ancestors = getAncestors('8.1.4.1').map((c) => c.number);
    expect(ancestors).toEqual(['8.1.4', '8.1', '8']);
  });

  it('returns a single ancestor for a level-2 clause', () => {
    expect(getAncestors('4.1').map((c) => c.number)).toEqual(['4']);
  });

  it('returns an empty array for a top-level clause', () => {
    expect(getAncestors('6')).toEqual([]);
  });

  it('returns an empty array for an unknown clause', () => {
    expect(getAncestors('not-real')).toEqual([]);
  });
});

describe('getRelatedClauses', () => {
  it('resolves crossReferences into clause objects', () => {
    const clause: ISO45001Clause | undefined = getClauseByNumber('6.1.2');
    expect(clause).toBeDefined();
    const related = getRelatedClauses('6.1.2').map((c) => c.number);
    expect(related).toEqual(clause?.crossReferences);
  });

  it('returns clause objects (not just numbers) for each reference', () => {
    const related = getRelatedClauses('8.2');
    expect(related.length).toBeGreaterThan(0);
    for (const c of related) {
      expect(c).toHaveProperty('title');
      expect(c).toHaveProperty('requirementText');
    }
  });

  it('returns an empty array for an unknown clause', () => {
    expect(getRelatedClauses('999')).toEqual([]);
  });

  it('only returns resolvable references (all dataset references resolve)', () => {
    for (const clause of ISO45001_CLAUSES) {
      const related = getRelatedClauses(clause.number);
      // Every cross-reference in the dataset is valid, so the resolved count
      // must equal the declared count.
      expect(related).toHaveLength(clause.crossReferences.length);
    }
  });
});
