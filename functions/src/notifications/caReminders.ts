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
  finding: Pick<
    Finding,
    'id' | 'tenantId' | 'findingNumber' | 'title' | 'targetClosureDate' | 'raisedByAuditorId'
  >;
  /** How many days before the due date this reminder fires (30 / 14 / 7). */
  offsetDays: number;
}

/**
 * Deterministic idempotency-marker id for one (finding, offset, day) reminder.
 * Written to the server-only `/tenants/{tenantId}/reminders` collection (no
 * client rule grants access) so a retried or double-scheduled run cannot email
 * the same reminder twice. Pure + exported for testing.
 */
export function reminderMarkerId(findingId: string, offsetDays: number, now: Date): string {
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${findingId}_${offsetDays}_${day}`;
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
    Pick<
      Finding,
      | 'id'
      | 'tenantId'
      | 'findingNumber'
      | 'title'
      | 'targetClosureDate'
      | 'status'
      | 'raisedByAuditorId'
    >
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
          raisedByAuditorId: finding.raisedByAuditorId,
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
    // cross-tenant mixing occurs when we email per-record. The orderBy makes
    // the query eligible for the composite COLLECTION_GROUP index on
    // (status, targetClosureDate) in firestore.indexes.json — without it the
    // filter has no supporting collection-group index and the whole job throws
    // FAILED_PRECONDITION. Findings without a targetClosureDate are dropped by
    // the orderBy, which matches selectDueReminders' own skip.
    const snapshot = await db
      .collectionGroup('findings')
      .where('status', 'in', ['open', 'acknowledged', 'ca_submitted', 'ca_review', 'overdue'])
      .orderBy('targetClosureDate')
      .get();

    const candidates = snapshot.docs.map((doc) => {
      const data = doc.data() as Finding;
      return {
        id: data.id,
        tenantId: data.tenantId,
        findingNumber: data.findingNumber,
        title: data.title,
        status: data.status,
        raisedByAuditorId: data.raisedByAuditorId,
        ...(data.targetClosureDate !== undefined
          ? { targetClosureDate: data.targetClosureDate }
          : {}),
      };
    });

    const dueReminders = selectDueReminders(candidates, now);

    await Promise.all(
      dueReminders.map(async (reminder) => {
        const { tenantId, id: findingId, raisedByAuditorId } = reminder.finding;

        // Idempotency: atomically claim this (finding, offset, day) reminder.
        // `create()` fails with ALREADY_EXISTS when a previous/concurrent run
        // sent it, so retried schedules never double-email.
        const marker = db.doc(
          `tenants/${tenantId}/reminders/${reminderMarkerId(findingId, reminder.offsetDays, now)}`,
        );
        try {
          await marker.create({
            findingId,
            offsetDays: reminder.offsetDays,
            createdAt: now.toISOString(),
          });
        } catch {
          return; // Already sent for this finding/offset/day.
        }

        // Resolve the responsible auditor's real address from the tenant's
        // user directory. Without a resolvable address the reminder is skipped
        // (and the marker released) rather than emailed to a synthetic alias.
        const userSnap = await db.doc(`tenants/${tenantId}/users/${raisedByAuditorId}`).get();
        const email = userSnap.get('email') as unknown;
        if (typeof email !== 'string' || email.length === 0) {
          console.warn(
            `[caReminders] No email for auditor ${raisedByAuditorId} (tenant ${tenantId}); skipping ${findingId}.`,
          );
          await marker.delete().catch(() => undefined);
          return;
        }

        const { subject, text } = buildReminderEmail(reminder);
        try {
          await sendEmail({ to: email, from: REMINDER_FROM_ADDRESS, subject, text });
        } catch (error) {
          // Release the claim so the next run can retry this reminder.
          await marker.delete().catch(() => undefined);
          throw error;
        }
      }),
    );
  },
);
