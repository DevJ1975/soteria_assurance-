/**
 * Persists opening and closing meeting records from the field.
 *
 * WHY THIS EXISTS
 * The meetings screen held its attendees and AI summary in React state, where
 * navigating away discarded them. The only durable artefact was the audio
 * blob, filed as generic evidence. ISO 19011 §6.4.3 / §6.4.10 / §6.6 make the
 * attendance record and the record of what was presented mandatory; an
 * accreditation body found an audio file and no evidence a meeting occurred.
 *
 * Meetings write DIRECTLY to `public.meetings` rather than through the local
 * WatermelonDB sync. That is a deliberate exception to the offline-first rule:
 * a meeting happens in a room with the auditee, usually with connectivity,
 * and its record is short and written once. When the device is offline the
 * caller is told so and keeps the draft; nothing is silently lost, and the
 * audio recording still goes through the offline-first evidence path.
 */
import { supabase } from '../lib/supabase';
import { isOnline } from './offline';
import type { MeetingAttendee, MeetingSummaryResponse } from '@soteria/core';

export interface SaveMeetingInput {
  tenantId: string;
  /** The audit's SERVER id. A local WatermelonDB id will be rejected by the FK. */
  auditRemoteId: string;
  type: 'opening' | 'closing';
  location: string;
  attendees: MeetingAttendee[];
  notes: string;
  transcription?: string;
  summary?: MeetingSummaryResponse | null;
  recordingDurationSeconds?: number | null;
}

export type SaveMeetingResult =
  | { status: 'saved' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

export async function saveMeeting(input: SaveMeetingInput): Promise<SaveMeetingResult> {
  if (!(await isOnline())) {
    return { status: 'offline' };
  }

  const { error } = await supabase.from('meetings').upsert(
    {
      tenant_id: input.tenantId,
      audit_id: input.auditRemoteId,
      type: input.type,
      scheduled_at: new Date().toISOString(),
      location: input.location,
      is_virtual: false,
      attendees: input.attendees,
      agenda_items: [],
      action_items: (input.summary?.actionItems ?? []).map((item, index) => ({
        actionId: `ai-${index + 1}`,
        description: item.description,
        owner: item.owner,
        isCompleted: false,
      })),
      signature_urls: [],
      key_decisions: input.summary?.keyDecisions ?? [],
      transcription: input.transcription ?? null,
      ai_summary: input.summary?.summary ?? null,
      recording_duration: input.recordingDurationSeconds ?? null,
      status: 'completed',
      notes: input.notes,
    },
    { onConflict: 'audit_id,type' },
  );

  if (error) {
    return { status: 'error', message: error.message };
  }
  return { status: 'saved' };
}
