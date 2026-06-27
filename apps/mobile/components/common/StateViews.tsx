/**
 * Shared empty / loading / section-heading presentational helpers. Keeps every
 * list screen visually consistent and token-driven (RULE 5). All copy is passed
 * in by callers from `@soteria/core` SoteriaStrings (RULE 4).
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export function LoadingState({ label }: { label: string }): JSX.Element {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary[500]} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <View style={styles.centered}>
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

export function SectionHeading({ title }: { title: string }): JSX.Element {
  return <Text style={styles.heading}>{title}</Text>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  muted: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[800],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
});
