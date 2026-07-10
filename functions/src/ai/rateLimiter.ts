/**
 * Firestore-backed sliding-window rate limiter for AI endpoints.
 *
 * SOTERIA RULE 7 — AI endpoints are capped at 100 requests per tenant per
 * rolling hour (multi-agent-guide §8). The window is enforced by counting the
 * tenant's `aiLogs` documents whose `createdAt` falls within the last hour.
 *
 * Using the audit log itself as the rate-limit source keeps a single source of
 * truth (every successful AI call is logged) and avoids a second counter that
 * could drift. The check is intentionally performed BEFORE the model call so a
 * tenant cannot exceed the cap.
 *
 * @packageDocumentation
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

/** Maximum AI requests permitted per tenant per rolling hour. */
export const AI_RATE_LIMIT_PER_HOUR = 100;

/** Length of the rolling window in milliseconds (one hour). */
export const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Result of a rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  /** Number of requests already made in the current window. */
  used: number;
  /** Requests remaining before the cap is hit. */
  remaining: number;
}

/**
 * Returns the path of a tenant's `aiLogs` subcollection.
 *
 * SOTERIA RULE 2 — always tenant-scoped.
 */
export function aiLogsPath(tenantId: string): string {
  return `tenants/${tenantId}/aiLogs`;
}

/**
 * Counts how many AI requests the tenant has made in the last hour.
 *
 * @param db       - Admin Firestore instance.
 * @param tenantId - Tenant whose usage is being measured.
 * @param now      - Current time (injectable for testing).
 */
export async function getRateLimitStatus(
  db: Firestore,
  tenantId: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = Timestamp.fromMillis(now.getTime() - AI_RATE_LIMIT_WINDOW_MS);
  const snapshot = await db
    .collection(aiLogsPath(tenantId))
    .where('createdAt', '>=', windowStart)
    .count()
    .get();

  const used = snapshot.data().count;
  const remaining = Math.max(0, AI_RATE_LIMIT_PER_HOUR - used);
  return {
    allowed: used < AI_RATE_LIMIT_PER_HOUR,
    used,
    remaining,
  };
}

/** Identifying fields stamped onto a rate-limit reservation (aiLogs doc). */
export interface RateLimitReservationInput {
  feature: string;
  uid: string;
  model: string;
}

/**
 * Atomically reserves a slot in the tenant's hourly AI window.
 *
 * The count-then-act runs inside a Firestore transaction that also CREATES the
 * aiLogs entry (status 'pending') in the same commit, so concurrent bursts
 * cannot slip past the cap: each in-flight request already counts against the
 * window the moment it is admitted. The handler later finalises the same
 * document via {@link ../ai/aiLog#writeAiLog} with the returned log id.
 *
 * @returns the reserved aiLogs document id.
 * @throws {HttpsError} `resource-exhausted` when the window is full.
 */
export async function reserveRateLimitSlot(
  db: Firestore,
  tenantId: string,
  entry: RateLimitReservationInput,
  now: Date = new Date(),
): Promise<string> {
  const windowStart = Timestamp.fromMillis(now.getTime() - AI_RATE_LIMIT_WINDOW_MS);
  const logs = db.collection(aiLogsPath(tenantId));

  return db.runTransaction(async (txn) => {
    const countSnapshot = await txn.get(
      logs.where('createdAt', '>=', windowStart).count(),
    );
    const used = countSnapshot.data().count;
    if (used >= AI_RATE_LIMIT_PER_HOUR) {
      throw new HttpsError(
        'resource-exhausted',
        `AI rate limit reached (${AI_RATE_LIMIT_PER_HOUR} requests/hour). Please try again later.`,
      );
    }

    const ref = logs.doc();
    txn.set(ref, {
      feature: entry.feature,
      uid: entry.uid,
      model: entry.model,
      status: 'pending',
      createdAt: Timestamp.fromDate(now),
    });
    return ref.id;
  });
}
