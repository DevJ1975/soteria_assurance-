/**
 * EvidenceCaptureButton (DESIGN_DOC §5.5).
 *
 * Opens an in-app camera (expo-camera), captures a photo, then hands the local
 * URI to {@link captureEvidence} which compresses + geotags it, writes the
 * Evidence row to WatermelonDB FIRST (RULE 9), and queues the background upload.
 * The UI returns immediately — uploads never block the auditor.
 */
import { useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { captureEvidence } from '../../services/evidenceService';
import { colors, fontSize, spacing } from '../../theme';

interface Props {
  tenantId: string;
  auditId: string;
  capturedByAuditorId: string;
  /** Clause numbers this evidence will be linked to. */
  clauseNumbers: string[];
  /** Optional title prefix for the captured file. */
  titlePrefix?: string;
}

export function EvidenceCaptureButton({
  tenantId,
  auditId,
  capturedByAuditorId,
  clauseNumbers,
  titlePrefix = 'Evidence',
}: Props): JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const handleOpen = async (): Promise<void> => {
    if (permission?.granted !== true) {
      const result = await requestPermission();
      if (!result.granted) {
        return;
      }
    }
    setOpen(true);
  };

  const handleCapture = async (): Promise<void> => {
    if (cameraRef.current === null) {
      return;
    }
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri !== undefined) {
        await captureEvidence({
          tenantId,
          auditId,
          capturedByAuditorId,
          uri: photo.uri,
          type: 'photo',
          title: `${titlePrefix} ${new Date().toLocaleTimeString()}`,
          description: '',
          clauseNumbers,
          geotag: true,
        });
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button mode="contained" icon="camera" onPress={handleOpen}>
        {SoteriaStrings.evidence.capturePhoto}
      </Button>

      <Modal visible={open} animationType="slide" onRequestClose={(): void => setOpen(false)}>
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.controls}>
            <Text style={styles.hint}>
              {SoteriaStrings.evidence.capturePhoto} — geotagged automatically
            </Text>
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                textColor={colors.surface}
                onPress={(): void => setOpen(false)}
                disabled={busy}
              >
                {SoteriaStrings.common.cancel}
              </Button>
              <Button mode="contained" onPress={handleCapture} loading={busy} disabled={busy}>
                {SoteriaStrings.common.confirm}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  cameraContainer: { flex: 1, backgroundColor: colors.primary[900] },
  camera: { flex: 1 },
  controls: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.primary[900],
  },
  hint: { color: colors.surface, fontSize: fontSize.sm, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
