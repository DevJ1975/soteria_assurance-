/**
 * Timestamp helpers for the local database.
 *
 * `@soteria/core` models time as a structural {@link Timestamp} rather than a
 * `Date`, so the same shape survives the boundary between Postgres, the
 * offline SQLite store and the shared domain types. SQLite stores epoch
 * milliseconds; these convert between the two.
 */
import type { Timestamp } from '@soteria/core';

/** Builds a core {@link Timestamp} from epoch milliseconds. */
export function timestampFromMillis(millis: number): Timestamp {
  return {
    seconds: Math.floor(millis / 1000),
    nanoseconds: (millis % 1000) * 1_000_000,
    toDate: () => new Date(millis),
    toMillis: () => millis,
  };
}

/** The current time as a core {@link Timestamp}. */
export function nowTimestamp(): Timestamp {
  return timestampFromMillis(Date.now());
}

/** Epoch milliseconds from a core {@link Timestamp}. */
export function millisFromTimestamp(timestamp: Timestamp): number {
  return timestamp.toMillis();
}
