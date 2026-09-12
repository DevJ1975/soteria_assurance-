import {
  DEFAULT_STANDARD_ID,
  ISO45001_CLAUSES,
  STANDARDS,
  getClauseByNumber,
  getChildClauses,
  getTopLevelClauses,
  getStandard,
  flattenClauses,
  getClauseTree,
  getAncestors,
  getRelatedClauses,
  isStandardAvailable,
  isStandardId,
  listAvailableStandards,
  listStandards,
} from '../standards';
import type {
  StandardClause,
  StandardClauseTreeNode,
  StandardDefinition,
  StandardId,
} from '../standards';

/** Derive the expected depth (level) from a dotted clause number. */
const expectedLevel = (standard: StandardDefinition, number: string): number => {
  if (standard.topLevelNumbers.includes(number)) {
    return 1;
  }
  return number.split('.').length;
};

/** Derive the expected immediate parent number from a dotted clause number. */
const expectedParent = (
  standard: StandardDefinition,
  number: string,
): string | undefined => {
  if (standard.topLevelNumbers.includes(number)) {
    return undefined;
  }
  const parts = number.split('.');
  parts.pop();
  return parts.join('.');
};

const nonEmptyStringArray = (value: string[]): boolean =>
  Array.isArray(value) && value.length > 0 && value.every((s) => s.trim().length > 0);

// ===========================================================================
// Registry — covers every standard, built or not.
// ===========================================================================

describe('standards registry', () => {
  const ALL_IDS: StandardId[] = ['iso45001', 'iso14001', 'iso9001'];

  it('registers every known standard id', () => {
    for (const id of ALL_IDS) {
      expect(getStandard(id)).toBeDefined();
      expect(getStandard(id).id).toBe(id);
    }
    expect(listStandards()).toHaveLength(ALL_IDS.length);
  });

  it('defaults to ISO 45001', () => {
    expect(DEFAULT_STANDARD_ID).toBe('iso45001');
    expect(isStandardAvailable(DEFAULT_STANDARD_ID)).toBe(true);
  });

  it('exposes ISO 45001 as the only available standard today', () => {
    expect(listAvailableStandards().map((s) => s.id)).toEqual(['iso45001']);
  });

  it('registers ISO 14001 and ISO 9001 as roadmap placeholders', () => {
    for (const id of ['iso14001', 'iso9001'] as StandardId[]) {
      const standard = getStandard(id);
      expect(standard.isAvailable).toBe(false);
      expect(standard.clauses).toHaveLength(0);
      // Metadata must be complete even while the dataset is empty — the UI
      // renders names and disciplines for coming-soon standards.
      expect(standard.name.trim().length).toBeGreaterThan(0);
      expect(standard.shortName.trim().length).toBeGreaterThan(0);
      expect(standard.discipline.trim().length).toBeGreaterThan(0);
      expect(standard.topLevelNumbers).toEqual(['4', '5', '6', '7', '8', '9', '10']);
    }
  });

  it('gives every standard a usable prompt profile before its clauses land', () => {
    for (const standard of listStandards()) {
      expect(standard.prompt.personaName.trim().length).toBeGreaterThan(0);
      expect(nonEmptyStringArray(standard.prompt.expertiseLines)).toBe(true);
      expect(nonEmptyStringArray(standard.prompt.riskMethodologies)).toBe(true);
    }
  });

  it('narrows arbitrary strings with isStandardId', () => {
    expect(isStandardId('iso45001')).toBe(true);
    expect(isStandardId('iso14001')).toBe(true);
    expect(isStandardId('ISO 45001:2018')).toBe(false);
    expect(isStandardId('')).toBe(false);
    expect(isStandardId('toString')).toBe(false);
  });

  it('keeps display names and slugs distinct across standards', () => {
    const names = listStandards().map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('freezes the registry against accidental mutation', () => {
    expect(Object.isFrozen(STANDARDS)).toBe(true);
  });
});

// ===========================================================================
// Helpers on an unauthored standard — the placeholder contract.
// ===========================================================================

describe('helpers on a standard with no clause data yet', () => {
  const PLACEHOLDER: StandardId = 'iso14001';

  it('returns empty results rather than throwing', () => {
    expect(getClauseByNumber(PLACEHOLDER, '6.1.2')).toBeUndefined();
    expect(getChildClauses(PLACEHOLDER, '6.1')).toEqual([]);
    expect(getTopLevelClauses(PLACEHOLDER)).toEqual([]);
    expect(flattenClauses(PLACEHOLDER)).toEqual([]);
    expect(getClauseTree(PLACEHOLDER)).toEqual([]);
    expect(getAncestors(PLACEHOLDER, '8.1.4.1')).toEqual([]);
    expect(getRelatedClauses(PLACEHOLDER, '6.1.2')).toEqual([]);
  });

  it('does not leak clauses across standards', () => {
    // "6.1.2" exists in ISO 45001; asking ISO 9001 for it must not resolve.
    expect(getClauseByNumber('iso45001', '6.1.2')).toBeDefined();
    expect(getClauseByNumber('iso9001', '6.1.2')).toBeUndefined();
  });
});

// ===========================================================================
// Dataset integrity — parameterized over every AVAILABLE standard, so a newly
// authored standard is held to the same bar the day `isAvailable` flips.
// ===========================================================================

describe.each(listAvailableStandards().map((s) => [s.id, s] as const))(
  '%s dataset integrity',
  (id, standard) => {
    it('contains a substantial, complete set of clauses', () => {
      expect(standard.clauses.length).toBeGreaterThanOrEqual(45);
    });

    it('has unique clause numbers', () => {
      const numbers = standard.clauses.map((c) => c.number);
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it('includes every declared top-level clause group', () => {
      for (const group of standard.topLevelNumbers) {
        expect(getClauseByNumber(id, group)).toBeDefined();
      }
      expect(
        getTopLevelClauses(id)
          .map((c) => c.number)
          .sort(),
      ).toEqual([...standard.topLevelNumbers].sort());
    });

    it('resolves every non-top-level parentNumber to an existing clause', () => {
      for (const clause of standard.clauses) {
        if (clause.parentNumber === undefined) {
          expect(standard.topLevelNumbers).toContain(clause.number);
        } else {
          expect(getClauseByNumber(id, clause.parentNumber)).toBeDefined();
        }
      }
    });

    it('assigns parentNumber matching the dotted-number hierarchy', () => {
      for (const clause of standard.clauses) {
        expect(clause.parentNumber).toBe(expectedParent(standard, clause.number));
      }
    });

    it('assigns level matching the dotted depth', () => {
      for (const clause of standard.clauses) {
        expect(clause.level).toBe(expectedLevel(standard, clause.number));
      }
    });

    it('has non-empty title and requirementText for every clause', () => {
      for (const clause of standard.clauses) {
        expect(clause.requirementText.trim().length).toBeGreaterThan(0);
        expect(clause.title.trim().length).toBeGreaterThan(0);
      }
    });

    it('has non-empty required string arrays for every clause', () => {
      for (const clause of standard.clauses) {
        expect(nonEmptyStringArray(clause.auditFocus)).toBe(true);
        expect(nonEmptyStringArray(clause.typicalAuditQuestions)).toBe(true);
        expect(nonEmptyStringArray(clause.commonNonconformities)).toBe(true);
        expect(nonEmptyStringArray(clause.expectedDocuments)).toBe(true);
        expect(nonEmptyStringArray(clause.crossReferences)).toBe(true);
      }
    });

    it('points every crossReference to a valid clause in the same standard', () => {
      for (const clause of standard.clauses) {
        for (const ref of clause.crossReferences) {
          expect(getClauseByNumber(id, ref)).toBeDefined();
        }
      }
    });

    it('never cross-references a clause to itself', () => {
      for (const clause of standard.clauses) {
        expect(clause.crossReferences).not.toContain(clause.number);
      }
    });

    it('produces a tree whose total node count equals the dataset size', () => {
      const countNodes = (nodes: StandardClauseTreeNode[]): number =>
        nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
      expect(countNodes(getClauseTree(id))).toBe(standard.clauses.length);
    });

    it('returns only parentless, level-1 clauses as top-level', () => {
      for (const clause of getTopLevelClauses(id)) {
        expect(clause.parentNumber).toBeUndefined();
        expect(clause.level).toBe(1);
      }
    });

    it('resolves every declared cross-reference via getRelatedClauses', () => {
      for (const clause of standard.clauses) {
        expect(getRelatedClauses(id, clause.number)).toHaveLength(
          clause.crossReferences.length,
        );
      }
    });

    it('returns a flattened copy that does not mutate the source dataset', () => {
      const flat = flattenClauses(id);
      const originalLength = standard.clauses.length;
      flat.pop();
      expect(standard.clauses).toHaveLength(originalLength);
    });
  },
);

// ===========================================================================
// ISO 45001-specific content assertions. These pin the shipped dataset and
// cannot be generalized across standards.
// ===========================================================================

describe('ISO 45001 dataset', () => {
  const ISO45001: StandardId = 'iso45001';

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
      expect(getClauseByNumber(ISO45001, number)).toBeDefined();
    }
  });

  it('has a level-4 clause exactly for the procurement grandchildren', () => {
    const levelFour = ISO45001_CLAUSES.filter((c) => c.level === 4).map((c) => c.number);
    expect(levelFour.sort()).toEqual(['8.1.4.1', '8.1.4.2', '8.1.4.3']);
  });

  describe('getClauseByNumber', () => {
    it('returns the matching clause', () => {
      const clause = getClauseByNumber(ISO45001, '6.1.2');
      expect(clause).toBeDefined();
      expect(clause?.title).toBe('Hazard identification and assessment of OH&S risks');
      expect(clause?.parentNumber).toBe('6.1');
      expect(clause?.level).toBe(3);
    });

    it('returns undefined for an unknown clause number', () => {
      expect(getClauseByNumber(ISO45001, '99.9')).toBeUndefined();
      expect(getClauseByNumber(ISO45001, '')).toBeUndefined();
    });
  });

  describe('getChildClauses', () => {
    it('returns the direct children of a clause', () => {
      const children = getChildClauses(ISO45001, '6.1').map((c) => c.number);
      expect(children).toEqual(['6.1.1', '6.1.2', '6.1.3', '6.1.4']);
    });

    it('returns the direct children of a top-level group', () => {
      const children = getChildClauses(ISO45001, '10').map((c) => c.number);
      expect(children).toEqual(['10.1', '10.2', '10.3']);
    });

    it('returns an empty array for a leaf clause', () => {
      expect(getChildClauses(ISO45001, '8.1.4.1')).toEqual([]);
    });

    it('returns an empty array for an unknown clause', () => {
      expect(getChildClauses(ISO45001, 'does-not-exist')).toEqual([]);
    });

    it('does not return grandchildren', () => {
      const children = getChildClauses(ISO45001, '8.1').map((c) => c.number);
      expect(children).toContain('8.1.4');
      expect(children).not.toContain('8.1.4.1');
    });
  });

  describe('getTopLevelClauses', () => {
    it('returns exactly the seven clause groups in order', () => {
      const numbers = getTopLevelClauses(ISO45001).map((c) => c.number);
      expect(numbers).toEqual(['4', '5', '6', '7', '8', '9', '10']);
    });
  });

  describe('flattenClauses', () => {
    it('returns all clauses', () => {
      expect(flattenClauses(ISO45001)).toHaveLength(ISO45001_CLAUSES.length);
    });
  });

  describe('getClauseTree', () => {
    it('returns one root node per top-level group', () => {
      const tree = getClauseTree(ISO45001);
      expect(tree.map((node) => node.clause.number)).toEqual([
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
      ]);
    });

    it('nests children recursively to the correct depth', () => {
      const tree = getClauseTree(ISO45001);
      const clause8 = tree.find((node) => node.clause.number === '8');
      expect(clause8).toBeDefined();

      const clause81 = clause8?.children.find((node) => node.clause.number === '8.1');
      expect(clause81).toBeDefined();

      const clause814 = clause81?.children.find((node) => node.clause.number === '8.1.4');
      expect(clause814).toBeDefined();

      const grandchildren = clause814?.children.map((node) => node.clause.number) ?? [];
      expect(grandchildren).toEqual(['8.1.4.1', '8.1.4.2', '8.1.4.3']);
    });

    it('marks leaf clauses with an empty children array', () => {
      const tree = getClauseTree(ISO45001);
      const clause10 = tree.find((node) => node.clause.number === '10');
      const clause101 = clause10?.children.find((node) => node.clause.number === '10.1');
      expect(clause101?.children).toEqual([]);
    });
  });

  describe('getAncestors', () => {
    it('returns ancestors from immediate parent up to the top group', () => {
      const ancestors = getAncestors(ISO45001, '8.1.4.1').map((c) => c.number);
      expect(ancestors).toEqual(['8.1.4', '8.1', '8']);
    });

    it('returns a single ancestor for a level-2 clause', () => {
      expect(getAncestors(ISO45001, '4.1').map((c) => c.number)).toEqual(['4']);
    });

    it('returns an empty array for a top-level clause', () => {
      expect(getAncestors(ISO45001, '6')).toEqual([]);
    });

    it('returns an empty array for an unknown clause', () => {
      expect(getAncestors(ISO45001, 'not-real')).toEqual([]);
    });
  });

  describe('getRelatedClauses', () => {
    it('resolves crossReferences into clause objects', () => {
      const clause: StandardClause | undefined = getClauseByNumber(ISO45001, '6.1.2');
      expect(clause).toBeDefined();
      const related = getRelatedClauses(ISO45001, '6.1.2').map((c) => c.number);
      expect(related).toEqual(clause?.crossReferences);
    });

    it('returns clause objects (not just numbers) for each reference', () => {
      const related = getRelatedClauses(ISO45001, '8.2');
      expect(related.length).toBeGreaterThan(0);
      for (const c of related) {
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('requirementText');
      }
    });

    it('returns an empty array for an unknown clause', () => {
      expect(getRelatedClauses(ISO45001, '999')).toEqual([]);
    });
  });
});
