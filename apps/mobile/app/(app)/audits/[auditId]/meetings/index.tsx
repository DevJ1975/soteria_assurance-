/**
 * Meetings (DESIGN_DOC §9.2 / §9.6) — opening & closing meeting studio.
 *
 * Phase-1 scope: record the meeting audio via {@link MeetingRecorder} and
 * persist the recording as an audio Evidence item (offline-first, RULE 9) for
 * later server-side transcription. Full attendee/agenda/signature management is
 * a later phase; the screen is wired and typed for it.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SegmentedButtons, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../../../components/common/Screen';
import { MeetingRecorder } from '../../../../../components/meetings/MeetingRecorder';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../../theme';
import { captureEvidence } from '../../../../../services/evidenceService';
import { useAuthStore } from '../../../../../stores/authStore';

type MeetingType = 'opening' | 'closing';

export default function MeetingsScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const auditorId = useAuthStore((s) => s.user?.uid ?? 'unknown');
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');

  const [type, setType] = useState<MeetingType>('opening');
  const [lastDuration, setLastDuration] = useState<number | null>(null);

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { marginBottom: spacing.md },
  card: { ...cardSurface, gap: spacing.md, alignItems: 'stretch' },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[800] },
  body: { fontSize: fontSize.sm, color: colors.textSecondary },
  saved: { fontSize: fontSize.sm, color: colors.conforming, textAlign: 'center' },
});
