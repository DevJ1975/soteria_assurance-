/**
 * FindingTypeBadge — a colored pill for a finding type or conformity status.
 *
 * Colors come exclusively from `@soteria/ui` (`getFindingColor` /
 * `getConformityColor`, RULE 5); labels come from `@soteria/core` metadata
 * (`FINDING_TYPE_META` / `CONFORMITY_STATUS_META`, RULE 4). No hardcoded hex.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  CONFORMITY_STATUS_META,
  FINDING_TYPE_META,
  type ConformityStatus,
  type FindingType,
} from '@soteria/core';
import { getConformityColor, getFindingColor } from '@soteria/ui';
import { fontSize, fontWeight, radius, spacing } from '../../theme';

export function FindingTypeBadge({ type }: { type: FindingType }): JSX.Element {
  const color = getFindingColor(type);
  const meta = FINDING_TYPE_META[type];
  return <Badge color={color} label={meta.code} title={meta.label} />;
}

export function ConformityBadge({ status }: { status: ConformityStatus }): JSX.Element {
  const color = getConformityColor(status);
  const meta = CONFORMITY_STATUS_META[status];
  return <Badge color={color} label={meta.label} />;
}

function Badge({
  color,
  label,
  title,
}: {
  color: string;
  label: string;
  title?: string;
}): JSX.Element {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {title ?? label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
