/**
 * Settings — account + tenant info, the live sync state (§11), a manual sync
 * trigger, and sign-out. Sign-out is delegated to the AuthProvider so all auth
 * and session state is cleared consistently.
 */
import { StyleSheet, View } from 'react-native';
import { Button, Divider, List, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../components/common/Screen';
import { SectionHeading } from '../../../components/common/StateViews';
import { SyncStatusDot } from '../../../components/common/SyncStatusDot';
import { cardSurface, colors, fontSize, spacing } from '../../../theme';
import { useAuth } from '../../../lib/AuthProvider';
import { useAuthStore } from '../../../stores/authStore';
import { useAuditStore } from '../../../stores/auditStore';
import { scheduleSync } from '../../../services/syncManager';

export default function SettingsScreen(): JSX.Element {
  const { signOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const claims = useAuthStore((s) => s.claims);
  const lastSyncedAt = useAuditStore((s) => s.lastSyncedAt);

  return (
    <Screen name="settings" scroll>
      <SectionHeading title="Account" />
      <View style={styles.card}>
        <List.Item
          title={user?.displayName ?? 'Auditor'}
          description={user?.email ?? '—'}
          left={(props: { color: string; style: object }): JSX.Element => (
            <List.Icon {...props} icon="account-circle" />
          )}
        />
        <Divider />
        <List.Item
          title="Role"
          description={claims?.role ?? 'Pending provisioning'}
          left={(props: { color: string; style: object }): JSX.Element => (
            <List.Icon {...props} icon="shield-account" />
          )}
        />
        <Divider />
        <List.Item
          title="Tenant"
          description={claims?.tenantId ?? '—'}
          left={(props: { color: string; style: object }): JSX.Element => (
            <List.Icon {...props} icon="domain" />
          )}
        />
      </View>

      <SectionHeading title="Sync" />
      <View style={styles.card}>
        <View style={styles.syncRow}>
          <SyncStatusDot />
        </View>
        <Text style={styles.syncMeta}>
          {lastSyncedAt !== null
            ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
            : 'Not yet synced'}
        </Text>
        <Button mode="outlined" icon="sync" onPress={scheduleSync} style={styles.syncButton}>
          {SoteriaStrings.common.syncing}
        </Button>
      </View>

      <Button
        mode="contained"
        buttonColor={colors.majorNC}
        icon="logout"
        onPress={(): void => {
          void signOut();
        }}
        style={styles.signOut}
      >
        {SoteriaStrings.auth.signOutButton}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { ...cardSurface, padding: 0, overflow: 'hidden' },
  syncRow: { padding: spacing.sm },
  syncMeta: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.md },
  syncButton: { margin: spacing.md },
  signOut: { marginTop: spacing.xl },
});
