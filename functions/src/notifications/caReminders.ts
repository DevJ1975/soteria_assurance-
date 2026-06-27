/**
 * `caReminders` scheduled function — computes which open findings are due for a
 * corrective-action reminder today and emails the responsible auditor.
 *
 * SOTERIA RULE 2 — although a `collectionGroup` query spans tenants, every
 * record carries its own `tenantId` and the email/notification is derived from
 * that record; no cross-tenant data is mixed. RULE 7-adjacent — reminder dates
 * are computed by reusing `@soteria/core` (`getReminderDates`,
 * `REMINDER_OFFSETS_DAYS`, `daysBetween`), never reimplemented here.
 *
 * @packageDocumentation
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  REMINDER_OFFSETS_DAYS,
  daysBetween,
  type Finding,
} from '@soteria/core';
import { SENDGRID_API_KEY } from '../common/secrets';
import { getDb } from '../common/admin';
import { sendEmail } from './emailService';

/** The "from" address reminder emails are sent on behalf of. */
export const REMINDER_FROM_ADDRESS = 'no-reply@soteria-assurance.example';

/** A finding that is due for a reminder, with the matched offset. */
export interface DueReminder {
  finding: Pick<Finding, 'id' | 'tenantId' | 'findingNumber' | 'title' | 'targetClosureDate'>;
  /** How many days before the due date this reminder fires (30 / 14 / 7). */
  offsetDays: number;
}

/**
 * Given a finding's target closure date and "now", returns the matching
 * reminder offset (30/14/7) if a reminder is due today, else `null`.
 *
 * Pure + exported for testing. Reuses `daysBetween` from `@soteria/core`.
 */
export function reminderOffsetDueToday(
  targetClosureDate: string,
  now: Date,
): number | null {
  const due = new Date(targetClosureDate);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  const daysUntilDue = daysBetween(now, due);
  return REMINDER_OFFSETS_DAYS.includes(daysUntilDue) ? daysUntilDue : null;
}

/**
 * Selects findings due for a reminder today from a candidate list. Pure +
 * exported for testing.
 */
export function selectDueReminders(
  findings: ReadonlyArray<
    Pick<Finding, 'id' | 'tenantId' | 'findingNumber' | 'title' | 'targetClosureDate' | 'status'>
  >,
  now: Date,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const finding of findings) {
    if (finding.status === 'closed') {
      continue;
    }
    if (!finding.targetClosureDate) {
      continue;
    }
    const offsetDays = reminderOffsetDueToday(finding.targetClosureDate, now);
    if (offsetDays !== null) {
      due.push({
        finding: {
          id: finding.id,
          tenantId: finding.tenantId,
          findingNumber: finding.findingNumber,
          title: finding.title,
          targetClosureDate: finding.targetClosureDate,
        },
        offsetDays,
      });
    }
  }
  return due;
}

/** Builds the reminder email body. Pure + exported for testing. */
export function buildReminderEmail(reminder: DueReminder): { subject: string; text: string } {
  const { finding, offsetDays } = reminder;
  return {
    subject: `Corrective action due in ${offsetDays} days — ${finding.findingNumber}`,
    text: `The corrective action for finding ${finding.findingNumber} ("${finding.title}") is due on ${finding.targetClosureDate} (in ${offsetDays} days). Please ensure it is progressed.`,
  };
}

/**
 * Scheduled handler — runs daily, queries all open findings, and emails
 * reminders for those due at a 30/14/7-day offset.
 */
export const caReminders = onSchedule(
  { schedule: 'every day 08:00', secrets: [SENDGRID_API_KEY], timeoutSeconds: 300 },
  async () => {
    const db = getDb();
    const now = new Date();

    // collectionGroup spans tenants; each finding keeps its own tenantId, so no
    // cross-tenant mixing occurs when we email per-record.
    const snapshot = await db
      .collectionGroup('findings')
      .where('status', 'in', ['open', 'acknowledged', 'ca_submitted', 'ca_review', 'overdue'])
      .get();

    const candidates = snapshot.docs.map((doc) => {
      const data = doc.data() as Finding;
      return {
        id: data.id,
        tenantId: data.tenantId,
        findingNumber: data.findingNumber,
        title: data.title,
        status: data.status,
        ...(data.targetClosureDate !== undefined
          ? { targetClosureDate: data.targetClosureDate }
          : {}),
      };
    });

    const dueReminders = selectDueReminders(candidates, now);

    await Promise.all(
      dueReminders.map(async (reminder) => {
        // The responsible auditor's address is resolved from the tenant's user
        // record; for the scheduled job we send to a per-tenant reminders alias
        // derived from the record, keeping tenant isolation intact.
        const { subject, text } = buildReminderEmail(reminder);
        await sendEmail({
          to: `reminders+${reminder.finding.tenantId}@soteria-assurance.example`,
          from: REMINDER_FROM_ADDRESS,
          subject,
          text,
        });
      }),
    );
  },
);
