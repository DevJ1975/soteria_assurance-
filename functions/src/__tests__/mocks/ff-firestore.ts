/** Test double for `firebase-functions/v2/firestore`. */

import type { CallableOptions } from './ff-https';

export interface FirestoreEvent {
  params: Record<string, string>;
  data?: {
    before: { data(): unknown };
    after: { data(): unknown };
  };
}

type TriggerHandler = (event: FirestoreEvent) => unknown;

export function onDocumentUpdated(
  _docPattern: string | CallableOptions,
  handler: TriggerHandler,
): TriggerHandler {
  return handler;
}
