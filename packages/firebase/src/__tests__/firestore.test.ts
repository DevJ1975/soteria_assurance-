/**
 * Tests for tenant-scoped Firestore path builders and converters.
 *
 * `firebase/firestore` is mocked so `collection()`/`doc()` simply record the
 * path segments they receive; `withConverter` is a passthrough that preserves
 * the recorded path. No network or real Firestore is involved.
 */

import type { Audit, Finding } from '@soteria/core';

// A lightweight stand-in for a Firestore reference that remembers its path.
interface PathRef {
  __path: string;
  withConverter: (converter: unknown) => PathRef & { __converter: unknown };
}

function makeRef(segments: string[]): PathRef {
  const path = segments.join('/');
  return {
    __path: path,
    withConverter(converter: unknown) {
      return { ...this, __path: path, __converter: converter };
    },
  };
}

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
  getApp: jest.fn(() => ({ name: 'mock-app' })),
  getApps: jest.fn(() => [{ name: 'mock-app' }]),
}));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn() }));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn() }));
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWhere = jest.fn((field: string, op: string, value: unknown) => ({ field, op, value }));
const mockQuery = jest.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ __db: true })),
  // collection(db, ...segments) / doc(db, ...segments): drop the db arg, keep path.
  collection: jest.fn((_db: unknown, ...segments: string[]) => makeRef(segments)),
  // doc(col, id) is also used (2-arg form): record the combined path.
  doc: jest.fn((first: unknown, ...rest: string[]) => {
    if (rest.length === 1 && first !== null && typeof first === 'object' && '__path' in first) {
      return makeRef([(first as PathRef).__path, rest[0] as string]);
    }
    return makeRef(rest);
  }),
  query: mockQuery,
  where: mockWhere,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
}));

import {
  aiLogsCol,
  auditConverter,
  auditDoc,
  auditsCol,
  clauseAssessmentsCol,
  clientsCol,
  correctiveActionsCol,
  createConverter,
  deleteDocById,
  evidenceCol,
  findingConverter,
  findingsCol,
  getAuditsForTenant,
  getDocById,
  listDocs,
  meetingsCol,
  patchDoc,
  reportsCol,
  setDocById,
  tenantDoc,
  usersCol,
  witnessStatementsCol,
} from '../firestore';

const TENANT = 'tenant-abc';
const AUDIT = 'audit-123';

function pathOf(ref: unknown): string {
  return (ref as { __path: string }).__path;
}

describe('tenant-scoped path builders', () => {
  it('builds the tenant document path', () => {
    expect(pathOf(tenantDoc(TENANT))).toBe('tenants/tenant-abc');
  });

  it('builds tenant-level collection paths', () => {
    expect(pathOf(usersCol(TENANT))).toBe('tenants/tenant-abc/users');
    expect(pathOf(clientsCol(TENANT))).toBe('tenants/tenant-abc/clients');
    expect(pathOf(auditsCol(TENANT))).toBe('tenants/tenant-abc/audits');
    expect(pathOf(correctiveActionsCol(TENANT))).toBe('tenants/tenant-abc/correctiveActions');
    expect(pathOf(reportsCol(TENANT))).toBe('tenants/tenant-abc/reports');
    expect(pathOf(aiLogsCol(TENANT))).toBe('tenants/tenant-abc/aiLogs');
  });

  it('builds the audit document path', () => {
    expect(pathOf(auditDoc(TENANT, AUDIT))).toBe('tenants/tenant-abc/audits/audit-123');
  });

  it('builds audit sub-collection paths', () => {
    expect(pathOf(clauseAssessmentsCol(TENANT, AUDIT))).toBe(
      'tenants/tenant-abc/audits/audit-123/clauses',
    );
    expect(pathOf(findingsCol(TENANT, AUDIT))).toBe('tenants/tenant-abc/audits/audit-123/findings');
    expect(pathOf(evidenceCol(TENANT, AUDIT))).toBe('tenants/tenant-abc/audits/audit-123/evidence');
    expect(pathOf(meetingsCol(TENANT, AUDIT))).toBe('tenants/tenant-abc/audits/audit-123/meetings');
    expect(pathOf(witnessStatementsCol(TENANT, AUDIT))).toBe(
      'tenants/tenant-abc/audits/audit-123/witnessStatements',
    );
  });

  it('every path is rooted at tenants/{tenantId} (RULE 2 isolation)', () => {
    const builders: Array<() => unknown> = [
      () => tenantDoc(TENANT),
      () => usersCol(TENANT),
      () => clientsCol(TENANT),
      () => auditsCol(TENANT),
      () => auditDoc(TENANT, AUDIT),
      () => findingsCol(TENANT, AUDIT),
      () => evidenceCol(TENANT, AUDIT),
      () => aiLogsCol(TENANT),
    ];
    for (const build of builders) {
      expect(pathOf(build())).toMatch(/^tenants\/tenant-abc(\/|$)/);
    }
  });

  it('rejects an empty tenantId', () => {
    expect(() => usersCol('')).toThrow(/tenantId is required/);
    expect(() => usersCol('   ')).toThrow(/tenantId is required/);
  });

  it('rejects an empty auditId', () => {
    expect(() => auditDoc(TENANT, '')).toThrow(/auditId/);
    expect(() => findingsCol(TENANT, '  ')).toThrow(/auditId/);
  });
});

describe('createConverter', () => {
  it('strips id on write and re-injects the snapshot id on read', () => {
    const converter = createConverter<Audit>();
    const audit = { id: 'a1', tenantId: TENANT, auditNumber: 'AUD-2026-001' } as Audit;

    const stored = converter.toFirestore(audit) as Record<string, unknown>;
    expect(stored).not.toHaveProperty('id');
    expect(stored).toMatchObject({ tenantId: TENANT, auditNumber: 'AUD-2026-001' });

    const snapshot = {
      id: 'a1',
      data: () => ({ tenantId: TENANT, auditNumber: 'AUD-2026-001' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal snapshot stub for the converter under test
    } as any;
    const read = converter.fromFirestore(snapshot, {});
    expect(read).toEqual({ id: 'a1', tenantId: TENANT, auditNumber: 'AUD-2026-001' });
  });

  it('snapshot id wins over any persisted id field', () => {
    const converter = createConverter<Finding>();
    const snapshot = {
      id: 'real-doc-id',
      data: () => ({ id: 'stale-id', tenantId: TENANT, findingNumber: 'NCR-1' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal snapshot stub for the converter under test
    } as any;
    const read = converter.fromFirestore(snapshot, {});
    expect(read.id).toBe('real-doc-id');
  });

  it('exposes shared converter singletons', () => {
    expect(typeof auditConverter.toFirestore).toBe('function');
    expect(typeof findingConverter.fromFirestore).toBe('function');
  });
});

describe('generic CRUD helpers', () => {
  it('getDocById returns the document data when it exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ id: 'u1' }) });
    await expect(getDocById(usersCol(TENANT), 'u1')).resolves.toEqual({ id: 'u1' });
  });

  it('getDocById returns null when the document is missing', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    await expect(getDocById(usersCol(TENANT), 'missing')).resolves.toBeNull();
  });

  it('getDocById rejects an empty id', async () => {
    await expect(getDocById(usersCol(TENANT), '')).rejects.toThrow(/non-empty/);
  });

  it('listDocs maps every snapshot through .data()', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ data: () => ({ id: 'a1' }) }, { data: () => ({ id: 'a2' }) }],
    });
    await expect(listDocs(auditsCol(TENANT))).resolves.toEqual([{ id: 'a1' }, { id: 'a2' }]);
  });

  it('setDocById writes at the model id and rejects an empty id', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await setDocById(auditsCol(TENANT), { id: 'a1' } as Audit);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);

    await expect(setDocById(auditsCol(TENANT), { id: '' } as Audit)).rejects.toThrow(/model.id/);
  });

  it('patchDoc performs a merge write', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await patchDoc(findingsCol(TENANT, AUDIT), 'f1', { status: 'closed' } as Partial<Finding>);
    const lastCall = mockSetDoc.mock.calls.at(-1);
    expect(lastCall?.[2]).toEqual({ merge: true });
  });

  it('deleteDocById delegates to deleteDoc', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined);
    await deleteDocById(findingsCol(TENANT, AUDIT), 'f1');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('getAuditsForTenant', () => {
  it('queries all tenant audits when no lead auditor is given', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [{ data: () => ({ id: 'a1' }) }] });
    const result = await getAuditsForTenant(TENANT);
    expect(result).toEqual([{ id: 'a1' }]);
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('filters by leadAuditorId when provided', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getAuditsForTenant(TENANT, 'lead-1');
    expect(mockWhere).toHaveBeenCalledWith('leadAuditorId', '==', 'lead-1');
  });

  it('ignores a blank leadAuditorId (no where clause)', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getAuditsForTenant(TENANT, '   ');
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('is tenant-scoped (rejects empty tenantId)', () => {
    // `auditsCol` validates the tenantId synchronously before any query runs.
    expect(() => getAuditsForTenant('')).toThrow(/tenantId is required/);
  });
});
