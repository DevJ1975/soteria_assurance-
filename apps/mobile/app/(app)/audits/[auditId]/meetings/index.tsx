/**
 * Meetings (DESIGN_DOC §9.2 / §9.6) — opening & closing meeting studio.
 *
 * Flow: record the meeting audio via {@link MeetingRecorder} (persisted as an
 * audio Evidence item, offline-first — RULE 9), then summarise the meeting from
 * its transcription with the `summarizeMeeting` AI callable (RULE 3 — the key
 * never leaves the server). Automatic speech-to-text is the remaining follow-up;
 * until then the transcription is entered/pasted here. Full attendee/agenda/
 * signature management is a later phase; the screen is typed for it.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SoteriaStrings, type MeetingSummaryResponse } from '@soteria/core';
import { Screen } from '../../../../../components/common/Screen';
import { MeetingRecorder } from '../../../../../components/meetings/MeetingRecorder';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../../theme';
import { captureEvidence } from '../../../../../services/evidenceService';
import { summarizeMeeting, AI_DISCLAIMER } from '../../../../../services/aiService';
import { useAuthStore } from '../../../../../stores/authStore';

type MeetingType = 'opening' | 'closing';

export default function MeetingsScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const auditorId = useAuthStore((s) => s.user?.uid ?? 'unknown');
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');

  const [type, setType] = useState<MeetingType>('opening');
  const [lastDuration, setLastDuration] = useState<number | null>(null);
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
  spinner: { marginTop: spacing.sm },
  saved: { fontSize: fontSize.sm, color: colors.conforming, textAlign: 'center' },
  error: { fontSize: fontSize.sm, color: colors.majorNC },
  summary: { gap: spacing.xs },
  bullet: { fontSize: fontSize.sm, color: colors.textPrimary },
  disclaimer: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm },
});
