/**
 * Audit list (DESIGN_DOC §9.1). Reads from the local DB (offline-first) and
 * lets the auditor open an audit, which sets it active in the audit store.
 */
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../components/common/Screen';
import { EmptyState, LoadingState } from '../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, radius, spacing } from '../../../theme';
import { useAudits } from '../../../lib/useLocalData';
import { auditStatusColor, auditStatusLabel, auditTypeLabel } from '../../../lib/labels';
import { useAuditStore } from '../../../stores/auditStore';
import type { Audit } from '../../../db/models/Audit';

export default function AuditListScreen(): JSX.Element {
  const router = useRouter();
  const { data: audits, loading } = useAudits();
  const setActiveAudit = useAuditStore((s) => s.setActiveAudit);

  const open = (audit: Audit): void => {
    setActiveAudit(audit.id);
    router.push(`/(app)/audits/${audit.id}`);
  };

  if (loading) {
    return (
      <Screen name="audits-list">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="audits-list">
      {audits.length === 0 ? (
        <EmptyState message={SoteriaStrings.audit.noAudits} />
      ) : (
        <FlatList
          data={audits}
          keyExtractor={(item): string => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }): JSX.Element => (
            <Pressable
              onPress={(): void => open(item)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.card,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.headerRow}>
                <Text style={styles.auditNumber}>{item.auditNumber}</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${auditStatusColor(item.status)}1A` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: auditStatusColor(item.status) }]}>
                    {auditStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.scope} numberOfLines={2}>
                {item.scope}
              </Text>
              <Text style={styles.meta}>
                {auditTypeLabel(item.auditType)} · {item.plannedStartDate} → {item.plannedEndDate}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xl },
  card: { ...cardSurface, marginBottom: spacing.sm, gap: spacing.xs },
  pressed: { opacity: 0.7 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  scope: { fontSize: fontSize.md, color: colors.textPrimary },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary },
});
