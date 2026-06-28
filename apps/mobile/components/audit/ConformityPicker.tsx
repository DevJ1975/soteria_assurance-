/**
 * ConformityPicker — segmented selector for a clause's {@link ConformityStatus}.
 *
 * Each option is colored from `@soteria/ui` (`getConformityColor`, RULE 5) and
 * labelled from `@soteria/core` (`CONFORMITY_STATUS_META`, RULE 4).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CONFORMITY_STATUS_META, type ConformityStatus } from '@soteria/core';
import { getConformityColor } from '@soteria/ui';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

const ORDER: ConformityStatus[] = [
  'conforming',
  'minor_nc',
  'major_nc',
  'not_applicable',
  'not_audited',
];

interface Props {
  value: ConformityStatus;
  onChange: (status: ConformityStatus) => void;
}

export function ConformityPicker({ value, onChange }: Props): JSX.Element {
  return (
    <View style={styles.row}>
      {ORDER.map((status) => {
        const selected = status === value;
        const color = getConformityColor(status);
        return (
          <Pressable
            key={status}
            onPress={(): void => onChange(status)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.option,
              { borderColor: selected ? color : colors.border },
              selected ? { backgroundColor: `${color}1A` } : null,
            ]}
          >
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text
              style={[
                styles.label,
                { color: selected ? color : colors.textSecondary },
                selected ? styles.labelSelected : null,
              ]}
            >
              {CONFORMITY_STATUS_META[status].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  dot: { width: 10, height: 10, borderRadius: radius.full },
  label: { fontSize: fontSize.sm },
  labelSelected: { fontWeight: fontWeight.semibold },
});
