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
 * @param type     - The finding type.
 * @param raisedAt - When the finding was raised.
 */
export function calculateTargetClosureDate(
  type: FindingType,
  raisedAt: Date,
): Date | null {
  const days = FINDING_TYPE_META[type].correctiveActionDays;
  if (days === null) {
    return null;
  }
  return addDays(raisedAt, days);
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
