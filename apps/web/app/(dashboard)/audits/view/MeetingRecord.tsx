'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SoteriaStrings, computeFindingsSummary } from '@soteria/core';
import type { Finding, Meeting, MeetingAttendee } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useMeetings, useSaveMeeting } from '@/lib/hooks';
import { timestampNow } from '@/lib/supabase-data';

type MeetingType = 'opening' | 'closing';

const ATTENDEE_ROLES: ReadonlyArray<MeetingAttendee['role']> = ['auditor', 'auditee', 'observer'];

function blankAttendee(): MeetingAttendee {
  return {
    attendeeId: crypto.randomUUID(),
    name: '',
    jobTitle: '',
    organization: '',
    role: 'auditee',
    isPresent: true,
  };
}

/**
 * Records the opening and closing meetings for an audit.
 *
 * WHY THIS EXISTS
 * `Meeting` was fully specified in the type model and nothing persisted it —
 * there was no `meetings` table, no web screen, and the mobile screen held its
 * AI summary in React state where navigation discarded it. The only durable
 * artefact was an audio file filed as generic evidence.
 *
 * ISO 19011 §6.4.3 and §6.4.10 require both meetings, and §6.6 requires
 * records of them. For a certification audit the attendance record, and the
 * record that the findings were presented and acknowledged at the closing
 * meeting, are the specific things an accreditation assessor asks to see.
 *
 * The closing meeting snapshots the findings summary AS PRESENTED. That is
 * deliberately a copy rather than a live join: the record must say what was
 * put in front of the auditee on the day, not what the findings happen to say
 * now.
 */
export function MeetingRecord({
  auditId,
  findings,
}: {
  auditId: string;
  findings: Finding[];
}) {
  const { data: meetings } = useMeetings(auditId);
  const [editing, setEditing] = useState<MeetingType | null>(null);

  const byType = (type: MeetingType): Meeting | undefined =>
    (meetings ?? []).find((meeting) => meeting.type === type);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meetings</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-md">
        {(['opening', 'closing'] as const).map((type) => {
          const meeting = byType(type);
          return (
            <div key={type} className="flex flex-col gap-sm">
              <div className="flex items-center justify-between gap-sm">
                <div className="flex items-center gap-sm">
                  <span className="font-medium capitalize text-text-primary">
                    {type} meeting
                  </span>
                  {meeting === undefined ? (
                    <Badge tone="neutral">Not recorded</Badge>
                  ) : (
                    <Badge tone="conforming">
                      {meeting.attendees.filter((a) => a.isPresent).length} present
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing(editing === type ? null : type)}
                >
                  {meeting === undefined ? 'Record' : 'Edit'}
                </Button>
              </div>

              {meeting !== undefined && editing !== type ? (
                <div className="rounded-md border border-border-soft bg-surface-muted p-sm text-xs text-text-secondary">
                  <p>
                    {meeting.location || 'No location recorded'} ·{' '}
                    {new Date(meeting.scheduledAt.toMillis()).toLocaleString()}
                  </p>
                  {meeting.attendees.length > 0 ? (
                    <p className="mt-1">
                      {meeting.attendees
                        .map((a) => `${a.name}${a.isPresent ? '' : ' (absent)'}`)
                        .join(', ')}
                    </p>
                  ) : null}
                  {meeting.notes !== '' ? <p className="mt-1">{meeting.notes}</p> : null}
                </div>
              ) : null}

              {editing === type ? (
                <MeetingForm
                  auditId={auditId}
                  type={type}
                  existing={meeting}
                  findings={findings}
                  onDone={() => setEditing(null)}
                />
              ) : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function MeetingForm({
  auditId,
  type,
  existing,
  findings,
  onDone,
}: {
  auditId: string;
  type: MeetingType;
  existing: Meeting | undefined;
  findings: Finding[];
  onDone: () => void;
}) {
  const saveMeeting = useSaveMeeting(auditId);
  const [location, setLocation] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [decisions, setDecisions] = useState('');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([blankAttendee()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing === undefined) {
      setScheduledAt(new Date().toISOString().slice(0, 16));
      return;
    }
    setLocation(existing.location);
    setScheduledAt(new Date(existing.scheduledAt.toMillis()).toISOString().slice(0, 16));
    setNotes(existing.notes);
    setDecisions((existing.keyDecisions ?? []).join('\n'));
    setAttendees(existing.attendees.length > 0 ? existing.attendees : [blankAttendee()]);
  }, [existing]);

  function patchAttendee(index: number, patch: Partial<MeetingAttendee>) {
    setAttendees((current) =>
      current.map((attendee, i) => (i === index ? { ...attendee, ...patch } : attendee)),
    );
  }

  async function onSave() {
    setError(null);
    const named = attendees.filter((attendee) => attendee.name.trim() !== '');
    if (named.length === 0) {
      setError('Record at least one attendee — attendance is the point of this record.');
      return;
    }
    try {
      await saveMeeting.mutateAsync({
        id: existing?.id ?? crypto.randomUUID(),
        auditId,
        type,
        scheduledAt: timestampNow(),
        location,
        isVirtual: /virtual|teams|zoom|meet/i.test(location),
        attendees: named,
        agendaItems: existing?.agendaItems ?? [],
        actionItems: existing?.actionItems ?? [],
        signatureUrls: existing?.signatureUrls ?? [],
        keyDecisions: decisions
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== ''),
        // Snapshot of what was presented, for the closing meeting only.
        findingsSummaryPresented:
          type === 'closing' ? computeFindingsSummary(findings) : undefined,
        status: 'completed',
        notes,
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  return (
    <div className="flex flex-col gap-md rounded-md border border-border-soft p-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Input
          label="Location"
          placeholder="Boardroom, or Virtual - Teams"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
        <Input
          label="Held at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Attendees</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAttendees((current) => [...current, blankAttendee()])}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>

        {attendees.map((attendee, index) => (
          <div
            key={attendee.attendeeId}
            className="grid grid-cols-1 items-end gap-sm md:grid-cols-[2fr_2fr_2fr_1.2fr_auto_auto]"
          >
            <Input
              label={index === 0 ? 'Name' : undefined}
              value={attendee.name}
              onChange={(event) => patchAttendee(index, { name: event.target.value })}
            />
            <Input
              label={index === 0 ? 'Job title' : undefined}
              value={attendee.jobTitle}
              onChange={(event) => patchAttendee(index, { jobTitle: event.target.value })}
            />
            <Input
              label={index === 0 ? 'Organization' : undefined}
              value={attendee.organization}
              onChange={(event) => patchAttendee(index, { organization: event.target.value })}
            />
            <Select
              label={index === 0 ? 'Role' : undefined}
              value={attendee.role}
              onChange={(event) =>
                patchAttendee(index, { role: event.target.value as MeetingAttendee['role'] })
              }
            >
              {ATTENDEE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1 pb-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={attendee.isPresent}
                onChange={(event) => patchAttendee(index, { isPresent: event.target.checked })}
              />
              Present
            </label>
            <button
              type="button"
              aria-label="Remove attendee"
              className="pb-2 text-text-muted hover:text-major-nc"
              onClick={() =>
                setAttendees((current) => current.filter((_, i) => i !== index))
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Textarea
        label="Key decisions (one per line)"
        rows={3}
        value={decisions}
        onChange={(event) => setDecisions(event.target.value)}
      />
      <Textarea
        label="Minutes / notes"
        rows={4}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      {type === 'closing' ? (
        <p className="text-xs text-text-muted">
          Saving records the findings summary as presented at this meeting — a snapshot, so
          it stays true even if the findings change afterwards.
        </p>
      ) : null}

      {error !== null ? <ErrorState message={error} /> : null}

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={onDone}>
          {SoteriaStrings.common.cancel}
        </Button>
        <Button loading={saveMeeting.isPending} onClick={onSave}>
          {SoteriaStrings.common.save}
        </Button>
      </div>
    </div>
  );
}
