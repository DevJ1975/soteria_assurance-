/**
 * AI audit logging.
 *
 * SOTERIA RULE 7 / multi-agent-guide §8 — every AI request is logged to
 * `/tenants/{tenantId}/aiLogs/`. The log doubles as the rate-limit source
 * (see {@link ./rateLimiter}), so the `createdAt` field MUST be a server
 * timestamp comparable to the rate-limit window.
 *
 * @packageDocumentation
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { aiLogsPath } from './rateLimiter';

/** The kind of AI feature that produced a log entry. */
export type AIFeature =
  | 'draft_ncr'
  | 'suggest_questions'
  | 'analyze_evidence'
  | 'generate_report_section';

/**
 * Outcome of an AI call, for observability and degradation tracking.
 * 'pending' marks a rate-limit reservation whose model call is still in
 * flight (see {@link ./rateLimiter#reserveRateLimitSlot}).
 */
export type AILogStatus = 'pending' | 'success' | 'error';

/** A single AI request/response audit record. */
export interface AILogEntry {
  feature: AIFeature;
  uid: string;
  model: string;
  status: AILogStatus;
  /** Approximate input tokens, if reported by the SDK. */
  inputTokens?: number;
  /** Approximate output tokens, if reported by the SDK. */
  outputTokens?: number;
  /** Error message (only when status is 'error'). */
  errorMessage?: string;
  createdAt: Timestamp;
}

/** The fields the caller supplies; `createdAt` is stamped by this helper. */
export type AILogInput = Omit<AILogEntry, 'createdAt'>;

/**
 * Writes an AI log entry to `/tenants/{tenantId}/aiLogs`.
 *
 * When `logId` is supplied the entry FINALISES an existing rate-limit
 * reservation (created by `reserveRateLimitSlot`): the reservation's
 * `createdAt` is preserved — it anchors the request's position in the
 * rate-limit window — and a `completedAt` stamp is added. Without `logId` a
 * fresh entry is appended.
 *
 * Returns the document id. Failures here must never mask the AI result, so
 * callers should await this but treat a logging error as non-fatal where
 * appropriate.
 */
export async function writeAiLog(
  db: Firestore,
  tenantId: string,
  entry: AILogInput,
  logId?: string,
): Promise<string> {
  const logs = db.collection(aiLogsPath(tenantId));
  if (logId !== undefined) {
    await logs.doc(logId).set({ ...entry, completedAt: Timestamp.now() }, { merge: true });
    return logId;
  }
  const ref = await logs.add({
    ...entry,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}
