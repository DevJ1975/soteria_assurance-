/** Test double for `firebase-functions/v2/scheduler`. */

export interface ScheduleOptions {
  schedule: string;
  secrets?: unknown[];
  timeoutSeconds?: number;
}

type ScheduleHandler = () => unknown;

export function onSchedule(
  _opts: ScheduleOptions,
  handler: ScheduleHandler,
): ScheduleHandler {
  return handler;
}
