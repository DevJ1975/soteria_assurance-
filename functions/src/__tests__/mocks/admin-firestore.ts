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
}

/**
 * The mock Firestore exposes jest-friendly hooks so each test controls the
 * outcome of the operations it exercises.
 */
export interface MockFirestore {
  count: number;
  added: Array<{ path: string; data: unknown }>;
  updated: Array<{ path: string; data: unknown }>;
  docs: Record<string, unknown>;
  subcollections: Record<string, Array<{ id: string; data: unknown }>>;
  groupDocs: Array<{ id: string; data: unknown }>;
}

export type Firestore = ReturnType<typeof makeFirestore>;

let state: MockFirestore = newState();

function newState(): MockFirestore {
  return { count: 0, added: [], updated: [], docs: {}, subcollections: {}, groupDocs: [] };
}

/** Test helper: reset and optionally seed the mock Firestore state. */
export function __resetFirestore(seed: Partial<MockFirestore> = {}): MockFirestore {
  state = { ...newState(), ...seed };
  return state;
}

/** Test helper: read the current mock state (for assertions). */
export function __getState(): MockFirestore {
  return state;
}

function makeFirestore() {
  const collection = (path: string) => ({
    where: (..._args: unknown[]) => ({
      count: () => ({
        get: async (): Promise<CountSnapshot> => ({ data: () => ({ count: state.count }) }),
      }),
      get: async (): Promise<QuerySnapshot> => ({
        docs: state.groupDocs.map((d) => ({ id: d.id, data: () => d.data })),
      }),
    }),
    add: async (data: unknown): Promise<{ id: string }> => {
      state.added.push({ path, data });
      return { id: `mock-${state.added.length}` };
    },
    get: async (): Promise<QuerySnapshot> => {
      const docs = state.subcollections[path] ?? [];
      return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
    },
  });

  const doc = (path: string) => ({
    get: async (): Promise<DocSnapshot> => {
      const has = Object.prototype.hasOwnProperty.call(state.docs, path);
      return { exists: has, data: () => state.docs[path] };
    },
    update: async (data: unknown): Promise<void> => {
      state.updated.push({ path, data });
    },
    collection: (sub: string) => collection(`${path}/${sub}`),
  });

  return {
    collection,
    doc,
    collectionGroup: (_name: string) => ({
      where: (..._args: unknown[]) => ({
        get: async (): Promise<QuerySnapshot> => ({
          docs: state.groupDocs.map((d) => ({ id: d.id, data: () => d.data })),
        }),
      }),
    }),
  };
}

export function getFirestore(_app: App): Firestore {
  return makeFirestore();
}
