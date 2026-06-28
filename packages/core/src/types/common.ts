/**
 * Shared structural types used across all @soteria/core domains.
 *
 * @packageDocumentation
 */

/**
 * A structural Firestore-compatible timestamp.
 *
 * `@soteria/core` is dependency-free and must NOT import `firebase` or
 * `firebase-admin`. This interface is declared structurally so that both the
 * Firebase **client** SDK `Timestamp` and the Firebase **admin** SDK
 * `Timestamp` are assignable to it (they both expose `seconds`,
 * `nanoseconds`, `toDate()` and `toMillis()`).
 */
export interface Timestamp {
  /** Seconds since the Unix epoch. */
  readonly seconds: number;
  /** Non-negative fraction of a second, in nanoseconds. */
  readonly nanoseconds: number;
  /** Converts this timestamp to a native {@link Date}. */
  toDate(): Date;
  /** Returns the number of milliseconds since the Unix epoch. */
  toMillis(): number;
}

/**
 * A WGS-84 geographic coordinate pair.
 */
export interface GeoCoordinates {
  lat: number;
  lng: number;
}
