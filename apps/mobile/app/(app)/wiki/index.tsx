/**
 * Wiki (DESIGN_DOC §15) — Phase-1 offline ISO 45001 clause guide.
 *
 * The reference content is the bundled `@soteria/core/iso45001` dataset (RULE 4,
 * never hardcoded clause text), so the guide is fully available offline in the
 * field. Each top-level clause group is searchable; tapping expands its
 * paraphrased requirement and audit focus. (Tenant-specific wiki articles from
 * Firestore are a later phase.)
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import type { ISO45001Clause } from '@soteria/core';
import { SoteriaStrings } from '@soteria/core';
import { flattenClauses } from '@soteria/core/iso45001';
import { Screen } from '../../../components/common/Screen';
import { EmptyState } from '../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../theme';

export default function WikiScreen(): JSX.Element {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const clauses = useMemo(() => flattenClauses(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') {
      return clauses;
    }
    return clauses.filter(
      (c) =>
        c.number.includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.requirementText.toLowerCase().includes(q),
    );
  }, [clauses, query]);

  const renderClause = (clause: ISO45001Clause): JSX.Element => {
    const isOpen = expanded === clause.number;
    return (
      <Pressable
        onPress={(): void => setExpanded(isOpen ? null : clause.number)}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <Text style={styles.number}>{clause.number}</Text>
          <Text style={styles.title} numberOfLines={isOpen ? undefined : 1}>
            {clause.title}
          </Text>
        </View>
        {isOpen ? (
          <View style={styles.detail}>
            <Text style={styles.requirement}>{clause.requirementText}</Text>
            {clause.auditFocus.length > 0 ? (
              <>
                <Text style={styles.subheading}>Audit focus</Text>
                {clause.auditFocus.map((focus, i) => (
                  <Text key={`focus-${i}`} style={styles.bullet}>
                    • {focus}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Screen name="wiki">
      <Searchbar
        placeholder={SoteriaStrings.common.search}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {filtered.length === 0 ? (
        <EmptyState message={SoteriaStrings.errors.notFound} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item): string => item.number}
          renderItem={({ item }): JSX.Element => renderClause(item)}
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xl },
  card: { ...cardSurface, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  number: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
    minWidth: 48,
  },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  detail: { marginTop: spacing.sm, gap: spacing.xs },
  requirement: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  subheading: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
    marginTop: spacing.sm,
  },
  bullet: { fontSize: fontSize.sm, color: colors.textSecondary },
});
