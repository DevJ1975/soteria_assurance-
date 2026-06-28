/**
 * Corrective Actions (DESIGN_DOC §9.8) — the tenant's CARs, read tenant-scoped
 * from Firestore via `@soteria/firebase` (RULE 2). Shows the CA number, title,
 * status and target date with an overdue indicator computed from the shared
 * `isOverdue` util.
 */
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { CAStatus } from '@soteria/core';
import { SoteriaStrings, isOverdue } from '@soteria/core';
import { Screen } from '../../../components/common/Screen';
import { EmptyState, LoadingState } from '../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, radius, spacing } from '../../../theme';
import { useCorrectiveActions } from '../../../lib/useTenantData';

const CA_STATUS_LABEL: Record<CAStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  closed: 'Closed',
};

const CA_STATUS_COLOR: Record<CAStatus, string> = {
  pending: colors.textMuted,
  in_progress: colors.warning,
  submitted: colors.ofi,
  accepted: colors.conforming,
  rejected: colors.majorNC,
  closed: colors.primary[500],
};

export default function CorrectiveActionsScreen(): JSX.Element {
  const { data, isLoading, isError } = useCorrectiveActions();

  if (isLoading) {
    return (
      <Screen name="corrective-actions">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen name="corrective-actions">
        <EmptyState message={SoteriaStrings.errors.network} />
      </Screen>
    );
  }

  const list = data ?? [];
  const now = new Date();

  return (
    <Screen name="corrective-actions">
      {list.length === 0 ? (
        <EmptyState message={SoteriaStrings.correctiveActions.noCorrectiveActions} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item): string => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }): JSX.Element => {
            const overdue =
              item.status !== 'closed' && isOverdue(new Date(item.targetDate), now);
            return (
              <View style={styles.card}>
                <View style={styles.headerRow}>
                  <Text style={styles.caNumber}>{item.caNumber}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: `${CA_STATUS_COLOR[item.status]}1A` },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: CA_STATUS_COLOR[item.status] }]}>
                      {CA_STATUS_LABEL[item.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={[styles.due, overdue ? styles.overdue : null]}>
                  Target: {item.targetDate}
                  {overdue ? ` · ${SoteriaStrings.findings.overdue}` : ''}
                </Text>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xl },
  card: { ...cardSurface, marginBottom: spacing.sm, gap: spacing.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  due: { fontSize: fontSize.sm, color: colors.textSecondary },
  overdue: { color: colors.majorNC, fontWeight: fontWeight.semibold },
});
