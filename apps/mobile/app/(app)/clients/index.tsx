/**
 * Clients (DESIGN_DOC §8) — the tenant's client organizations, read tenant-scoped
 * from Firestore via `@soteria/firebase` (RULE 2). A back-office reference list,
 * so it fetches on demand via React Query rather than the offline DB.
 */
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../components/common/Screen';
import { EmptyState, LoadingState } from '../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../theme';
import { useClients } from '../../../lib/useTenantData';

export default function ClientsScreen(): JSX.Element {
  const { data: clients, isLoading, isError } = useClients();

  if (isLoading) {
    return (
      <Screen name="clients">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen name="clients">
        <EmptyState message={SoteriaStrings.errors.network} />
      </Screen>
    );
  }

  const list = clients ?? [];

  return (
    <Screen name="clients">
      {list.length === 0 ? (
        <EmptyState message="No clients yet." />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item): string => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }): JSX.Element => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.organizationName}</Text>
              <Text style={styles.meta}>
                {item.industry} · {item.numberOfSites} site
                {item.numberOfSites === 1 ? '' : 's'} · {item.numberOfEmployees} employees
              </Text>
              <Text style={styles.contact}>
                {item.contactName} · {item.contactEmail}
              </Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xl },
  card: { ...cardSurface, marginBottom: spacing.sm, gap: spacing.xs },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary[800] },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary },
  contact: { fontSize: fontSize.sm, color: colors.textPrimary },
});
