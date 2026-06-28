/**
 * ClauseCard — a single ISO 45001 clause row in the clause navigator (§9.3).
 *
 * Shows the clause number (mono, like a code), title, the current conformity
 * status badge, and a completion check. Clause data comes from
 * `@soteria/core/iso45001` (never hardcoded — RULE 4); the assessment status is
 * the local WatermelonDB row (or `not_audited` when none exists yet).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import type { ConformityStatus, ISO45001Clause } from '@soteria/core';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';
import { ConformityBadge } from '../findings/FindingTypeBadge';

interface Props {
  clause: ISO45001Clause;
  status: ConformityStatus;
  isComplete: boolean;
  onPress: () => void;
}

export function ClauseCard({ clause, status, isComplete, onPress }: Props): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        pressed ? styles.pressed : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Clause ${clause.number} ${clause.title}`}
    >
      <View style={styles.header}>
        <Text style={styles.number}>{clause.number}</Text>
        {isComplete ? (
          <MaterialCommunityIcons
            name="check-circle"
            size={18}
            color={colors.conforming}
          />
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {clause.title}
      </Text>
      <View style={styles.footer}>
        <ConformityBadge status={status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  footer: { marginTop: spacing.xs },
});
