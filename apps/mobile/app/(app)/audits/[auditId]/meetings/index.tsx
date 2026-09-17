/**
 * Meetings (DESIGN_DOC §9.2 / §9.6) — opening & closing meeting studio.
 *
 * Flow: record the meeting audio via {@link MeetingRecorder} (persisted as an
 * audio Evidence item, offline-first — RULE 9), then summarise the meeting from
 * its transcription with the `summarizeMeeting` AI callable (RULE 3 — the key
 * never leaves the server). Automatic speech-to-text is the remaining follow-up;
 * until then the transcription is entered/pasted here.
 *
 * The record — attendance, notes, summary, decisions — is PERSISTED to
 * `public.meetings` via {@link saveMeeting}. It used to live only in React
 * state and was gone on navigation; attendance at the opening and closing
 * meetings is a mandatory audit record (ISO 19011 6.4.3 / 6.4.10 / 6.6).
 */
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import {
  DEFAULT_STANDARD_ID,
  SoteriaStrings,
  type MeetingAttendee,
  type MeetingSummaryResponse,
} from '@soteria/core';
import { Screen } from '../../../../../components/common/Screen';
import { MeetingRecorder } from '../../../../../components/meetings/MeetingRecorder';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../../theme';
import { captureEvidence } from '../../../../../services/evidenceService';
import { summarizeMeeting, AI_DISCLAIMER } from '../../../../../services/aiService';
import { saveMeeting } from '../../../../../services/meetingService';
import { useAuthStore } from '../../../../../stores/authStore';
import { useAudit } from '../../../../../lib/useLocalData';

type MeetingType = 'opening' | 'closing';

export default function MeetingsScreen(): React.JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const auditorId = useAuthStore((s) => s.user?.uid ?? 'unknown');
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');

  const { data: audit } = useAudit(auditId);

  const [type, setType] = useState<MeetingType>('opening');
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [newAttendee, setNewAttendee] = useState('');
  const [saveState, setSaveState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState<MeetingSummaryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecordingComplete = async (uri: string, duration: number): Promise<void> => {
    setLastDuration(duration);
    await captureEvidence({
      tenantId,
      auditId,
      capturedByAuditorId: auditorId,
      uri,
      type: 'audio',
      title: `${type === 'opening' ? 'Opening' : 'Closing'} meeting recording`,
      description: `Duration ${duration}s`,
      clauseNumbers: [],
      geotag: false,
    });
  };

  const handleSummarize = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const result = await summarizeMeeting({
        tenantId,
        standardId: DEFAULT_STANDARD_ID,
        meetingType: type,
        transcription: transcription.trim(),
      });
      setSummary(result.summary);
    } catch {
      setError(SoteriaStrings.ai.unavailable);
    } finally {
      setBusy(false);
    }
  };

  const canSummarize = transcription.trim().length > 0 && !busy;

  const addAttendee = (): void => {
    const name = newAttendee.trim();
    if (name === '') return;
    setAttendees((current) => [
      ...current,
      {
        attendeeId: `${Date.now()}-${current.length}`,
        name,
        jobTitle: '',
        organization: '',
        role: 'auditee',
        isPresent: true,
      },
    ]);
    setNewAttendee('');
  };

  const handleSaveRecord = async (): Promise<void> => {
    setSaveState(null);
    if (attendees.length === 0) {
      setSaveState('Record at least one attendee — attendance is the point of this record.');
      return;
    }
    // The server id, not the local one: the FK on meetings.audit_id is a uuid.
    const auditRemoteId = audit?.remoteId ?? null;
    if (auditRemoteId === null) {
      setSaveState('This audit has not synced yet; sync first, then save the meeting record.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveMeeting({
        tenantId,
        auditRemoteId,
        type,
        location,
        attendees,
        notes,
        transcription: transcription.trim() || undefined,
        summary,
        recordingDurationSeconds: lastDuration,
      });
      if (result.status === 'saved') {
        setSaveState(`${type === 'opening' ? 'Opening' : 'Closing'} meeting record saved.`);
      } else if (result.status === 'offline') {
        setSaveState('Offline — the draft is kept on screen. Save again when you have signal.');
      } else {
        setSaveState(result.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen name="meetings" scroll>
      <SegmentedButtons
        value={type}
        onValueChange={(v: string): void => setType(v as MeetingType)}
        buttons={[
          { value: 'opening', label: SoteriaStrings.meetings.openingTitle },
          { value: 'closing', label: SoteriaStrings.meetings.closingTitle },
        ]}
        style={styles.switch}
      />

      <View style={styles.card}>
        <Text style={styles.heading}>
          {type === 'opening'
            ? SoteriaStrings.meetings.openingTitle
            : SoteriaStrings.meetings.closingTitle}
        </Text>
        <Text style={styles.body}>
          Record the meeting for AI transcription. The recording is saved locally
          first and uploaded in the background.
        </Text>
        <MeetingRecorder onRecordingComplete={handleRecordingComplete} />
        {lastDuration !== null ? (
          <Text style={styles.saved}>
            {SoteriaStrings.common.synced} ({lastDuration}s)
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Attendance and minutes</Text>
        <TextInput
          mode="outlined"
          value={location}
          onChangeText={setLocation}
          placeholder="Location (e.g. Site office)"
          style={styles.input}
        />
        <View style={styles.attendeeRow}>
          <TextInput
            mode="outlined"
            value={newAttendee}
            onChangeText={setNewAttendee}
            placeholder="Attendee name"
            style={[styles.input, styles.attendeeInput]}
            onSubmitEditing={addAttendee}
          />
          <IconButton icon="account-plus" onPress={addAttendee} accessibilityLabel="Add attendee" />
        </View>
        {attendees.map((attendee, index) => (
          <View key={attendee.attendeeId} style={styles.attendeeRow}>
            <Text style={styles.bullet}>• {attendee.name}</Text>
            <IconButton
              icon="close"
              size={16}
              accessibilityLabel="Remove attendee"
              onPress={(): void =>
                setAttendees((current) => current.filter((_, i) => i !== index))
              }
            />
          </View>
        ))}
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          placeholder="Minutes / notes"
          style={styles.input}
        />
        <Button
          mode="contained"
          icon="content-save"
          loading={saving}
          disabled={saving}
          onPress={(): void => {
            void handleSaveRecord();
          }}
        >
          Save meeting record
        </Button>
        {saveState !== null ? <Text style={styles.body}>{saveState}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{SoteriaStrings.meetings.summarize}</Text>
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={5}
          value={transcription}
          onChangeText={setTranscription}
          placeholder="Paste or type the meeting transcription…"
          style={styles.input}
        />
        <Button
          mode="contained"
          icon="text-box-check-outline"
          disabled={!canSummarize}
          onPress={handleSummarize}
        >
          {SoteriaStrings.meetings.summarize}
        </Button>
        {busy ? <ActivityIndicator style={styles.spinner} /> : null}
        {error !== null ? <Text style={styles.error}>{error}</Text> : null}

        {summary !== null ? (
          <View style={styles.summary}>
            <Text style={styles.subheading}>{SoteriaStrings.meetings.summaryLabel}</Text>
            <Text style={styles.body}>{summary.summary}</Text>

            {summary.keyDecisions.length > 0 ? (
              <>
                <Text style={styles.subheading}>
                  {SoteriaStrings.meetings.keyDecisionsLabel}
                </Text>
                {summary.keyDecisions.map((d, i) => (
                  <Text key={`d-${i}`} style={styles.bullet}>
                    • {d}
                  </Text>
                ))}
              </>
            ) : null}

            {summary.actionItems.length > 0 ? (
              <>
                <Text style={styles.subheading}>
                  {SoteriaStrings.meetings.actionItemsLabel}
                </Text>
                {summary.actionItems.map((a, i) => (
                  <Text key={`a-${i}`} style={styles.bullet}>
                    • {a.description} — {a.owner}
                  </Text>
                ))}
              </>
            ) : null}

            <Text style={styles.disclaimer}>{AI_DISCLAIMER}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { marginBottom: spacing.md },
  card: { ...cardSurface, gap: spacing.md, alignItems: 'stretch', marginBottom: spacing.md },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[800] },
  subheading: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  body: { fontSize: fontSize.sm, color: colors.textSecondary },
  input: { backgroundColor: colors.surface },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attendeeInput: { flex: 1 },
  spinner: { marginTop: spacing.sm },
  saved: { fontSize: fontSize.sm, color: colors.conforming, textAlign: 'center' },
  error: { fontSize: fontSize.sm, color: colors.majorNC },
  summary: { gap: spacing.xs },
  bullet: { fontSize: fontSize.sm, color: colors.textPrimary },
  disclaimer: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm },
});
