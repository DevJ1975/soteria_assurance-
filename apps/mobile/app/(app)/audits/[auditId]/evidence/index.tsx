/**
 * Evidence (DESIGN_DOC §5.5 / §9.3) — captured field evidence gallery plus the
 * capture button. Each tile shows the local image (pre-upload) or the remote
 * URL, its upload state, and whether it is geotagged. Capture writes locally
 * first and queues a background upload (RULE 9).
 */
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../../../components/common/Screen';
import { EmptyState, LoadingState } from '../../../../../components/common/StateViews';
import { EvidenceCaptureButton } from '../../../../../components/evidence/EvidenceCaptureButton';
import { cardSurface, colors, fontSize, fontWeight, radius, spacing } from '../../../../../theme';
import { useEvidence } from '../../../../../lib/useLocalData';
import { useAuthStore } from '../../../../../stores/authStore';
import { useAuditStore } from '../../../../../stores/auditStore';
import type { UploadStatus } from '../../../../../db/models/Evidence';

const UPLOAD_LABEL: Record<UploadStatus, string> = {
  local_only: 'Queued',
  uploading: 'Uploading…',
  uploaded: 'Uploaded',
  failed: 'Upload failed',
};

const UPLOAD_COLOR: Record<UploadStatus, string> = {
  local_only: colors.textMuted,
  uploading: colors.warning,
  uploaded: colors.conforming,
  failed: colors.majorNC,
};

export default function EvidenceScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: evidence, loading } = useEvidence(auditId);
  const auditorId = useAuthStore((s) => s.user?.uid ?? 'unknown');
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');
  const activeClause = useAuditStore((s) => s.activeClauseNumber);

  if (loading) {
    return (
      <Screen name="evidence">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="evidence">
      <View style={styles.captureBar}>
        <EvidenceCaptureButton
          tenantId={tenantId}
          auditId={auditId}
          capturedByAuditorId={auditorId}
          clauseNumbers={activeClause !== null ? [activeClause] : []}
        />
      </View>

      {evidence.length === 0 ? (
        <EmptyState message={SoteriaStrings.evidence.noEvidence} />
      ) : (
        <FlatList
          data={evidence}
          keyExtractor={(item): string => item.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          renderItem={({ item }): JSX.Element => {
            const uri = item.fileUrl !== '' ? item.fileUrl : item.localUri;
            return (
              <View style={styles.tile}>
                {uri !== null ? (
                  <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <MaterialCommunityIcons
                      name="file-outline"
                      size={28}
                      color={colors.textMuted}
                    />
                  </View>
                )}
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.tileMeta}>
                  {item.geoLocation !== null ? (
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={14}
                      color={colors.secondary[500]}
                    />
                  ) : null}
                  <Text style={[styles.uploadLabel, { color: UPLOAD_COLOR[item.uploadStatus] }]}>
                    {UPLOAD_LABEL[item.uploadStatus]}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  captureBar: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xl },
  column: { gap: spacing.sm },
  tile: { ...cardSurface, flex: 1, marginBottom: spacing.sm, padding: spacing.sm, gap: spacing.xs },
  thumb: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: colors.primary[50] },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textPrimary },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  uploadLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
});
