/**
 * MeetingRecorder — captures opening/closing meeting audio (§9.2 / §9.6).
 *
 * Records with expo-av; the recording URI is handed back to the caller, which
 * stores it as evidence and later queues it for server-side transcription. All
 * labels come from SoteriaStrings (RULE 4); colors from tokens (RULE 5).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { Button, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

interface Props {
  /** Called with the local recording URI and its duration (seconds) on stop. */
  onRecordingComplete: (uri: string, durationSeconds: number) => void;
}

export function MeetingRecorder({ onRecordingComplete }: Props): JSX.Element {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Tick the elapsed timer while recording.
  useEffect(() => {
    if (recording === null) {
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const start = async (): Promise<void> => {
    setError(null);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError(SoteriaStrings.errors.permissionDenied);
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setElapsed(0);
      setRecording(rec);
    } catch {
      setError(SoteriaStrings.errors.generic);
    }
  };

  const stop = async (): Promise<void> => {
    if (recording === null) {
      return;
    }
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri !== null) {
        onRecordingComplete(uri, elapsed);
      }
    } finally {
      setRecording(null);
    }
  };

  const minutes = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (elapsed % 60).toString().padStart(2, '0');

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: recording !== null ? colors.majorNC : colors.textMuted },
          ]}
        />
        <Text style={styles.timer}>
          {minutes}:{seconds}
        </Text>
      </View>
      {recording === null ? (
        <Button mode="contained" icon="microphone" onPress={start}>
          {SoteriaStrings.meetings.startMeeting}
        </Button>
      ) : (
        <Button mode="contained" icon="stop" buttonColor={colors.majorNC} onPress={stop}>
          {SoteriaStrings.meetings.endMeeting}
        </Button>
      )}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  timer: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  error: { color: colors.majorNC, fontSize: fontSize.sm },
});
