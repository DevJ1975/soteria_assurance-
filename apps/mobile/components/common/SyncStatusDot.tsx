/**
 * SyncStatusDot (DESIGN_DOC §11 sync status indicator).
 *
 * Always-visible header dot reflecting the live {@link SyncIndicator} from the
 * audit store:
 *   - green  = fully synced
 *   - amber  = sync pending (X changes)
 *   - red    = sync failed (tap for details)
 *   - grey   = offline
 *   - (syncing reuses amber with a subtle label)
 *
 * Colors come from `@soteria/ui` tokens (RULE 5): green→conforming,
 * amber→warning, red→majorNC, grey→textMuted.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';
import { useAuditStore, type SyncIndicator } from '../../stores/auditStore';

const DOT_COLOR: Record<SyncIndicator, string> = {
  synced: colors.conforming,
  pending: colors.warning,
  syncing: colors.warning,
  failed: colors.majorNC,
  offline: colors.textMuted,
};

function labelFor(indicator: SyncIndicator, pending: number): string {
  switch (indicator) {
    case 'synced':
      return SoteriaStrings.common.synced;
    case 'syncing':
      return SoteriaStrings.common.syncing;
    case 'offline':
      return SoteriaStrings.common.offline;
    case 'failed':
      return SoteriaStrings.errors.network;
    case 'pending':
      return `${pending} ${pending === 1 ? 'change' : 'changes'} pending`;
    default:
      return '';
  }
}

export function SyncStatusDot({ onPress }: { onPress?: () => void }): JSX.Element {
  const indicator = useAuditStore((s) => s.syncIndicator);
  const pending = useAuditStore((s) => s.pendingChanges);

  return (
    <Pressable
      onPress={onPress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={labelFor(indicator, pending)}
    >
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[indicator] }]} />
      <Text style={styles.label} numberOfLines={1}>
        {labelFor(indicator, pending)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    maxWidth: 160,
  },
});
