import type { FindingType } from '../types/finding';
import { FINDING_TYPE_META } from '../constants/findingTypes';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days before the due date on which reminders should fire. */
export const REMINDER_OFFSETS_DAYS: readonly number[] = [30, 14, 7] as const;

/**
 * Adds `days` calendar days to `date`, returning a new {@link Date}.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Whole-day difference `b - a` (positive when `b` is after `a`).
 *
 * Uses UTC-midnight normalization so that times-of-day do not produce
 * off-by-one results.
 */
export function daysBetween(a: Date, b: Date): number {
  const startOfDay = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}

/**
 * Computes the mandatory corrective-action target closure date for a finding.
 *
 * Returns `null` when the finding type has no mandatory corrective action
 * (OFI, strong point, observation) per DESIGN_DOC §4.
 *
 * ANCHOR THE CLOCK TO THE END OF THE AUDIT, NOT TO EACH FINDING
 * Certification-body practice and ISO/IEC 17021-1 §9.4.5.2 start the
 * corrective-action period at the closing meeting — the point at which the
 * auditee is formally presented with the findings. Anchoring each finding to
 * the moment it happened to be typed gives a finding raised on day 1 of a
 * 5-day audit a deadline four days earlier than an identical finding raised on
 * day 5, which is inconsistent and indefensible to an auditee who notices.
 *
 * Pass the audit's end date as `anchor`. Callers that genuinely have no audit
 * end date yet (a finding raised mid-fieldwork before the end date is set) may
 * pass the raise date and correct it when the audit closes.
 *
 * @param type        - The finding type.
 * @param anchor      - The audit end date, or the raise date as a fallback.
 * @param overrideDays - A certification body's own window, when its procedure
 *                       differs from the defaults in FINDING_TYPE_META. Only
 *                       applies to types that require corrective action at all.
 */
export function calculateTargetClosureDate(
  type: FindingType,
  anchor: Date,
  overrideDays?: number,
): Date | null {
  const defaultDays = FINDING_TYPE_META[type].correctiveActionDays;
  if (defaultDays === null) {
    return null;
  }
  const days = overrideDays !== undefined && overrideDays > 0 ? overrideDays : defaultDays;
  return addDays(anchor, days);
}

/**
 * Returns the reminder dates (30, 14 and 7 days before the due date).
 *
 * Reminder dates that fall on or before the epoch boundary are still returned;
 * the caller decides whether to suppress past reminders.
 */
export function getReminderDates(due: Date): Date[] {
  return REMINDER_OFFSETS_DAYS.map((offset) => addDays(due, -offset));
}

/**
 * Returns `true` when `due` is strictly before `now` (i.e. overdue).
 */
export function isOverdue(due: Date, now: Date): boolean {
  return due.getTime() < now.getTime();
}
