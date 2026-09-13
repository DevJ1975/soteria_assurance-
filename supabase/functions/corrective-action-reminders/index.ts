/**
 * Chases corrective actions that are due, due today, or overdue.
 *
 * Runs on a schedule rather than from a request, so it cannot authenticate a
 * user. It is gated on a shared secret instead (`CRON_SECRET`) and registered
 * with `verify_jwt = false`, because a cron caller has no JWT to present.
 *
 * Escalation is deliberately NOT done here — it is a database function on a
 * pg_cron schedule. A state change the audit record depends on must happen
 * whether or not an email provider is reachable; only the chasing needs a
 * network. This function calls it anyway so a manual run does both, but the
 * daily guarantee does not depend on this function running at all.
 */
import { HttpError, handleRequest, jsonResponse, serviceClient } from '../_shared/auth.ts';

interface DueRow {
  id: string;
  tenant_id: string;
  ca_number: string;
  title: string;
  target_date: string;
  status: string;
  responsible_person_name: string;
  responsible_person_email: string;
  last_reminder_sent_at: string | null;
  reminder_count: number;
  days_until_due: number;
  urgency: 'overdue' | 'due_today' | 'due_soon';
}

/** At most one reminder per action per day, however often the job runs. */
const REMINDER_INTERVAL_HOURS = 20;

function subject(row: DueRow): string {
  if (row.urgency === 'overdue') {
    return `Overdue: corrective action ${row.ca_number} was due ${row.target_date}`;
  }
  if (row.urgency === 'due_today') return `Due today: corrective action ${row.ca_number}`;
  return `Due in ${row.days_until_due} days: corrective action ${row.ca_number}`;
}

function body(row: DueRow): string {
  const lead =
    row.urgency === 'overdue'
      ? `Corrective action ${row.ca_number} passed its target date of ${row.target_date} and is now overdue.`
      : `Corrective action ${row.ca_number} is due on ${row.target_date}.`;
  return [
    `Hello ${row.responsible_person_name || 'there'},`,
    '',
    lead,
    '',
    `  Action: ${row.title}`,
    `  Status: ${row.status}`,
    '',
    'Please update it in Soteria Assurance. An action is only closed once its',
    'effectiveness has been reviewed and accepted by an auditor.',
  ].join('\n');
}

/**
 * Sends one email through SendGrid.
 *
 * Returns false rather than throwing when the provider is unconfigured, so a
 * project without email still runs the job, stamps nothing, and reports how
 * many it could not send — which is more useful than a 500.
 */
async function sendEmail(to: string, subjectLine: string, text: string): Promise<boolean> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  const from = Deno.env.get('REMINDER_FROM_EMAIL');
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: 'Soteria Assurance' },
      subject: subjectLine,
      content: [{ type: 'text/plain', value: text }],
    }),
  });
  if (!response.ok) {
    console.error('sendgrid', response.status, await response.text());
    return false;
  }
  return true;
}

Deno.serve(
  handleRequest(async (request) => {
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');

    const expected = Deno.env.get('CRON_SECRET');
    if (!expected) {
      throw new HttpError(503, 'CRON_SECRET is not set on this project.');
    }
    if (request.headers.get('x-cron-secret') !== expected) {
      throw new HttpError(401, 'Authentication required.');
    }

    const admin = serviceClient();

    // Run escalation first so a newly-overdue action is chased as overdue in
    // the same pass rather than a day later.
    const { data: escalated, error: escalateError } = await admin.rpc('escalate_overdue_corrective_actions');
    if (escalateError) console.error(escalateError);

    const { data, error } = await admin
      .from('corrective_actions_due')
      .select('*')
      .order('target_date');
    if (error) throw new HttpError(500, 'Could not load due corrective actions.');

    const rows = (data ?? []) as DueRow[];
    const cutoff = Date.now() - REMINDER_INTERVAL_HOURS * 60 * 60 * 1000;

    let sent = 0;
    let skipped = 0;
    let unsent = 0;

    for (const row of rows) {
      if (!row.responsible_person_email) {
        skipped += 1;
        continue;
      }
      if (row.last_reminder_sent_at && Date.parse(row.last_reminder_sent_at) > cutoff) {
        skipped += 1;
        continue;
      }

      const ok = await sendEmail(row.responsible_person_email, subject(row), body(row));
      if (!ok) {
        unsent += 1;
        continue;
      }

      // Stamped only after a successful send, so a provider outage means the
      // next run retries rather than silently skipping a day. The cutoff is
      // re-checked here, at write time, so two overlapping runs can't both
      // win the update and double-count (or under-increment) the same row.
      const { data: updatedRows, error: updateError } = await admin
        .from('corrective_actions')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: row.reminder_count + 1,
        })
        .eq('id', row.id)
        // The value is quoted because it contains a "." (millisecond
        // separator), which `or()` would otherwise parse as part of its own
        // column.operator.value delimiters.
        .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt."${new Date(cutoff).toISOString()}"`)
        .select('id');
      if (updateError) {
        console.error(updateError);
      } else if (updatedRows && updatedRows.length > 0) {
        sent += 1;
      }
    }

    return jsonResponse({
      escalated: escalated ?? 0,
      due: rows.length,
      sent,
      skipped,
      unsent,
      emailConfigured: Boolean(Deno.env.get('SENDGRID_API_KEY')),
    });
  }),
);
