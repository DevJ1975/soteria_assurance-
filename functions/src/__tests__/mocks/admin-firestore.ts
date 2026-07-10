/**
 * Test double for `firebase-admin/firestore`.
 *
 * Implements the narrow query surface the functions source uses. Behaviour is
 * driven by jest mock functions the individual tests install, rather than a
 * full in-memory store, keeping each test explicit about what Firestore
 * returns.
 */

import type { App } from './admin-app';

export class Timestamp {
  public constructor(
    public readonly seconds: number,
    public readonly nanoseconds: number,
  ) {}
  public static now(): Timestamp {
    return Timestamp.fromMillis(Date.now());
  }
  public static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  public static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }
  public toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
  public toDate(): Date {
    return new Date(this.toMillis());
  }
}

export const FieldValue = {
  serverTimestamp(): { __server: true } {
    return { __server: true };
  },
};

export interface CountSnapshot {
  data(): { count: number };
}

export interface QueryDocSnapshot {
  id: string;
  data(): unknown;
}

export interface QuerySnapshot {
  docs: QueryDocSnapshot[];
}

export interface DocSnapshot {
  exists: boolean;
  data(): unknown;
  /** Field accessor, mirroring the admin SDK's `snapshot.get(path)`. */
  get(field: string): unknown;
}

/**
 * The mock Firestore exposes jest-friendly hooks so each test controls the
 * outcome of the operations it exercises.
 */
export interface MockFirestore {
  count: number;
  added: Array<{ path: string; data: unknown }>;
  updated: Array<{ path: string; data: unknown }>;
  /** Doc payloads recorded by `doc().set()` (including txn.set / merge). */
  setDocs: Array<{ path: string; data: unknown; merge: boolean }>;
  /** Doc payloads recorded by `doc().create()`. */
  created: Array<{ path: string; data: unknown }>;
  /** Paths deleted via `doc().delete()`. */
  deleted: string[];
  docs: Record<string, unknown>;
  subcollections: Record<string, Array<{ id: string; data: unknown }>>;
  groupDocs: Array<{ id: string; data: unknown }>;
  /** When set, `doc().create()` for these paths rejects (ALREADY_EXISTS). */
  existingMarkers: Set<string>;
}

export type Firestore = ReturnType<typeof makeFirestore>;

let state: MockFirestore = newState();
let docAutoId = 0;

function newState(): MockFirestore {
  return {
    count: 0,
    added: [],
    updated: [],
    setDocs: [],
    created: [],
    deleted: [],
    docs: {},
    subcollections: {},
    groupDocs: [],
    existingMarkers: new Set<string>(),
  };
}

/** Test helper: reset and optionally seed the mock Firestore state. */
export function __resetFirestore(seed: Partial<MockFirestore> = {}): MockFirestore {
  state = { ...newState(), ...seed };
  docAutoId = 0;
  return state;
}

/** Test helper: read the current mock state (for assertions). */
export function __getState(): MockFirestore {
  return state;
}

/** Marker interface so `txn.get` can distinguish aggregate queries. */
interface MockAggregateQuery {
  __kind: 'count';
  get(): Promise<CountSnapshot>;
}

/**
 * Transaction surface the source uses. `get` is typed to return the aggregate
 * snapshot shape for aggregate queries and the doc snapshot otherwise; the
 * mock dispatches at runtime.
 */
export interface MockTransaction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double boundary
  get(target: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double boundary
  set(ref: any, data: unknown): void;
}

function makeDocSnapshot(path: string): DocSnapshot {
  const has = Object.prototype.hasOwnProperty.call(state.docs, path);
  const payload = state.docs[path];
  return {
    exists: has,
    data: () => payload,
    get: (field: string) =>
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)[field]
        : undefined,
  };
}

function makeDocRef(path: string) {
  return {
    id: path.split('/').pop() ?? path,
    path,
    get: async (): Promise<DocSnapshot> => makeDocSnapshot(path),
    update: async (data: unknown): Promise<void> => {
      state.updated.push({ path, data });
    },
    set: async (data: unknown, options?: { merge?: boolean }): Promise<void> => {
      state.setDocs.push({ path, data, merge: options?.merge === true });
    },
    create: async (data: unknown): Promise<void> => {
      if (state.existingMarkers.has(path)) {
        const err = new Error(`ALREADY_EXISTS: document ${path}`);
        (err as Error & { code: number }).code = 6; // gRPC ALREADY_EXISTS
        throw err;
      }
      state.existingMarkers.add(path);
      state.created.push({ path, data });
    },
    delete: async (): Promise<void> => {
      state.deleted.push(path);
      state.existingMarkers.delete(path);
    },
    collection: (sub: string) => makeCollection(`${path}/${sub}`),
  };
}

function makeQuery(): {
  count: () => MockAggregateQuery;
  orderBy: (..._args: unknown[]) => ReturnType<typeof makeQuery>;
  get: () => Promise<QuerySnapshot>;
} {
  const query = {
    count: (): MockAggregateQuery => ({
      __kind: 'count' as const,
      get: async (): Promise<CountSnapshot> => ({ data: () => ({ count: state.count }) }),
    }),
    orderBy: (..._args: unknown[]) => query,
    get: async (): Promise<QuerySnapshot> => ({
      docs: state.groupDocs.map((d) => ({ id: d.id, data: () => d.data })),
    }),
  };
  return query;
}

function makeCollection(path: string) {
  return {
    where: (..._args: unknown[]) => makeQuery(),
    add: async (data: unknown): Promise<{ id: string }> => {
      state.added.push({ path, data });
      return { id: `mock-${state.added.length}` };
    },
    doc: (id?: string) => {
      docAutoId += 1;
      return makeDocRef(`${path}/${id ?? `auto-${docAutoId}`}`);
    },
    get: async (): Promise<QuerySnapshot> => {
      const docs = state.subcollections[path] ?? [];
      return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
    },
  };
}

function makeFirestore() {
  return {
    collection: makeCollection,
    doc: makeDocRef,
    collectionGroup: (_name: string) => ({
      where: (..._args: unknown[]) => makeQuery(),
    }),
    runTransaction: async <T>(fn: (txn: MockTransaction) => Promise<T>): Promise<T> => {
      const txn: MockTransaction = {
        get: async (target: MockAggregateQuery | ReturnType<typeof makeDocRef>) => {
          if ('__kind' in target && target.__kind === 'count') {
            return target.get();
          }
          return (target as ReturnType<typeof makeDocRef>).get();
        },
        set: (ref: ReturnType<typeof makeDocRef>, data: unknown): void => {
          state.setDocs.push({ path: ref.path, data, merge: false });
        },
      };
      return fn(txn);
    },
  };
}

export function getFirestore(_app: App): Firestore {
  return makeFirestore();
}
