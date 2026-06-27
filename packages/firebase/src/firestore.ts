/**
 * Strictly tenant-scoped Firestore helpers.
 *
 * SOTERIA RULE 2 (NON-NEGOTIABLE): every Firestore path produced here is
 * rooted at `tenants/${tenantId}/…`. There is intentionally NO helper that
 * targets a root collection without a `tenantId`, so cross-tenant access is
 * impossible by construction. All CRUD helpers REQUIRE a `tenantId`.
 *
 * Mirrors the collection hierarchy in DESIGN_DOC §8.
 *
 * @packageDocumentation
 */

import type {
  Audit,
  Client,
  ClauseAssessment,
  CorrectiveAction,
  Evidence,
  Finding,
  Meeting,
  Tenant,
  User,
  WitnessStatement,
} from '@soteria/core';
import {
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type PartialWithFieldValue,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type WithFieldValue,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';

// ---------------------------------------------------------------------------
// Collection / sub-collection path segments (DESIGN_DOC §8)
// ---------------------------------------------------------------------------

/** Root collection holding every tenant document. */
export const TENANTS_COLLECTION = 'tenants';

const USERS = 'users';
const CLIENTS = 'clients';
const AUDITS = 'audits';
const CLAUSE_ASSESSMENTS = 'clauses';
const FINDINGS = 'findings';
const EVIDENCE = 'evidence';
const MEETINGS = 'meetings';
const WITNESS_STATEMENTS = 'witnessStatements';
const CORRECTIVE_ACTIONS = 'correctiveActions';
const REPORTS = 'reports';
const AI_LOGS = 'aiLogs';

/**
 * Guards against an empty / whitespace `tenantId` reaching a Firestore path,
 * which would silently widen the query scope. Throwing here keeps RULE 2
 * enforceable even when callers pass a bad value at runtime.
 */
function requireTenantId(tenantId: string): string {
  if (tenantId.trim() === '') {
    throw new Error('tenantId is required for all Firestore operations (tenant isolation).');
  }
  return tenantId;
}

function requireId(value: string, label: string): string {
  if (value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Typed converters (@soteria/core types)
// ---------------------------------------------------------------------------

/**
 * Builds a {@link FirestoreDataConverter} for a Soteria domain type `T`.
 *
 * On write, the document `id` is stripped (Firestore stores it as the doc key,
 * not a field). On read, the snapshot id is injected back as `id` so consumers
 * always get a fully-populated, typed object.
 */
export function createConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: WithFieldValue<T>): DocumentData {
      // Drop `id`: it is the document key, never a stored field. Build a shallow
      // copy without `id` rather than a destructure-and-discard (which trips the
      // no-unused-vars lint rule on the discarded binding).
      const out: DocumentData = { ...(model as DocumentData) };
      delete out['id'];
      return out;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      const data = snapshot.data();
      // The snapshot id is authoritative; spread it over any persisted `id`.
      return { ...data, id: snapshot.id } as T;
    },
  };
}

/** Shared, reusable converter instances per domain type. */
export const tenantConverter = createConverter<Tenant>();
export const userConverter = createConverter<User>();
export const clientConverter = createConverter<Client>();
export const auditConverter = createConverter<Audit>();
export const clauseAssessmentConverter = createConverter<ClauseAssessment>();
export const findingConverter = createConverter<Finding>();
export const evidenceConverter = createConverter<Evidence>();
export const meetingConverter = createConverter<Meeting>();
export const witnessStatementConverter = createConverter<WitnessStatement>();
export const correctiveActionConverter = createConverter<CorrectiveAction>();

// ---------------------------------------------------------------------------
// Path builders — tenant level
// ---------------------------------------------------------------------------

/** `tenants/{tenantId}` — the tenant document. */
export function tenantDoc(tenantId: string): DocumentReference<Tenant> {
  return doc(getFirebaseDb(), TENANTS_COLLECTION, requireTenantId(tenantId)).withConverter(
    tenantConverter,
  );
}

/** `tenants/{tenantId}/users` */
export function usersCol(tenantId: string): CollectionReference<User> {
  return collection(getFirebaseDb(), TENANTS_COLLECTION, requireTenantId(tenantId), USERS).withConverter(
    userConverter,
  );
}

/** `tenants/{tenantId}/clients` */
export function clientsCol(tenantId: string): CollectionReference<Client> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    CLIENTS,
  ).withConverter(clientConverter);
}

/** `tenants/{tenantId}/audits` */
export function auditsCol(tenantId: string): CollectionReference<Audit> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
  ).withConverter(auditConverter);
}

/** `tenants/{tenantId}/audits/{auditId}` */
export function auditDoc(tenantId: string, auditId: string): DocumentReference<Audit> {
  return doc(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
  ).withConverter(auditConverter);
}

/** `tenants/{tenantId}/correctiveActions` */
export function correctiveActionsCol(tenantId: string): CollectionReference<CorrectiveAction> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    CORRECTIVE_ACTIONS,
  ).withConverter(correctiveActionConverter);
}

/** `tenants/{tenantId}/reports` (no domain converter — report shape varies). */
export function reportsCol(tenantId: string): CollectionReference<DocumentData> {
  return collection(getFirebaseDb(), TENANTS_COLLECTION, requireTenantId(tenantId), REPORTS);
}

/** `tenants/{tenantId}/aiLogs` (SOTERIA RULE 7 — AI audit trail). */
export function aiLogsCol(tenantId: string): CollectionReference<DocumentData> {
  return collection(getFirebaseDb(), TENANTS_COLLECTION, requireTenantId(tenantId), AI_LOGS);
}

// ---------------------------------------------------------------------------
// Path builders — audit sub-collections
// ---------------------------------------------------------------------------

/** `tenants/{tenantId}/audits/{auditId}/clauses` */
export function clauseAssessmentsCol(
  tenantId: string,
  auditId: string,
): CollectionReference<ClauseAssessment> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
    CLAUSE_ASSESSMENTS,
  ).withConverter(clauseAssessmentConverter);
}

/** `tenants/{tenantId}/audits/{auditId}/findings` */
export function findingsCol(tenantId: string, auditId: string): CollectionReference<Finding> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
    FINDINGS,
  ).withConverter(findingConverter);
}

/** `tenants/{tenantId}/audits/{auditId}/evidence` */
export function evidenceCol(tenantId: string, auditId: string): CollectionReference<Evidence> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
    EVIDENCE,
  ).withConverter(evidenceConverter);
}

/** `tenants/{tenantId}/audits/{auditId}/meetings` */
export function meetingsCol(tenantId: string, auditId: string): CollectionReference<Meeting> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
    MEETINGS,
  ).withConverter(meetingConverter);
}

/** `tenants/{tenantId}/audits/{auditId}/witnessStatements` */
export function witnessStatementsCol(
  tenantId: string,
  auditId: string,
): CollectionReference<WitnessStatement> {
  return collection(
    getFirebaseDb(),
    TENANTS_COLLECTION,
    requireTenantId(tenantId),
    AUDITS,
    requireId(auditId, 'auditId'),
    WITNESS_STATEMENTS,
  ).withConverter(witnessStatementConverter);
}

// ---------------------------------------------------------------------------
// Generic CRUD helpers — every helper REQUIRES a tenant-scoped reference
// ---------------------------------------------------------------------------

/**
 * Reads a document by id from a tenant-scoped collection. Returns `null` when
 * the document does not exist.
 */
export async function getDocById<T>(
  col: CollectionReference<T>,
  id: string,
): Promise<T | null> {
  const snapshot = await getDoc(doc(col, requireId(id, 'id')));
  return snapshot.exists() ? snapshot.data() : null;
}

/** Reads all documents in a tenant-scoped collection (optionally filtered). */
export async function listDocs<T>(
  col: CollectionReference<T>,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snapshot = await getDocs(query(col, ...constraints));
  return snapshot.docs.map((d) => d.data());
}

/**
 * Creates or fully overwrites a document at `{collection}/{model.id}`.
 *
 * The model carries its own `id`; the converter strips it from the stored
 * payload. Use {@link patchDoc} for partial updates.
 */
export async function setDocById<T extends { id: string }>(
  col: CollectionReference<T>,
  model: T,
): Promise<void> {
  await setDoc(doc(col, requireId(model.id, 'model.id')), model as WithFieldValue<T>);
}

/** Applies a partial update to an existing tenant-scoped document. */
export async function patchDoc<T>(
  col: CollectionReference<T>,
  id: string,
  patch: PartialWithFieldValue<T>,
): Promise<void> {
  // setDoc with { merge: true } is converter-aware (updateDoc bypasses the
  // converter), so partial typed patches round-trip through the converter.
  await setDoc(doc(col, requireId(id, 'id')), patch, { merge: true });
}

/** Applies a field-path update bypassing the converter (e.g. FieldValue ops). */
export async function updateDocFields<T>(
  col: CollectionReference<T>,
  id: string,
  fields: DocumentData,
): Promise<void> {
  await updateDoc(doc(col, requireId(id, 'id')), fields);
}

/** Deletes a tenant-scoped document by id. */
export async function deleteDocById<T>(col: CollectionReference<T>, id: string): Promise<void> {
  await deleteDoc(doc(col, requireId(id, 'id')));
}

// ---------------------------------------------------------------------------
// Domain queries (DESIGN_DOC §5 / §8)
// ---------------------------------------------------------------------------

/**
 * Returns all audits for a tenant, optionally filtered to a single lead
 * auditor. Always tenant-scoped via {@link auditsCol} (RULE 2).
 *
 * @param tenantId       owning tenant.
 * @param leadAuditorId  when provided, restricts results to audits led by this
 *                       user (`Audit.leadAuditorId`).
 */
export function getAuditsForTenant(tenantId: string, leadAuditorId?: string): Promise<Audit[]> {
  const col = auditsCol(tenantId);
  if (leadAuditorId !== undefined && leadAuditorId.trim() !== '') {
    return listDocs(col, where('leadAuditorId', '==', leadAuditorId));
  }
  return listDocs(col);
}
