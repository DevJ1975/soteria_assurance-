/**
 * Test double for `firebase-functions/v2/https`.
 * Mapped via tsconfig.test paths + jest moduleNameMapper.
 */

export class HttpsError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'HttpsError';
  }
}

export interface CallableRequest<T = unknown> {
  data: T;
  auth?: { uid: string; token: Record<string, unknown> };
}

export interface CallableOptions {
  secrets?: unknown[];
  timeoutSeconds?: number;
}

type Handler<R> = (request: CallableRequest<unknown>) => R;

export function onCall<R>(opts: CallableOptions, handler: Handler<R>): Handler<R>;
export function onCall<R>(handler: Handler<R>): Handler<R>;
export function onCall<R>(a: CallableOptions | Handler<R>, b?: Handler<R>): Handler<R> {
  return typeof a === 'function' ? a : (b as Handler<R>);
}
