/**
 * Audits stack navigator — wraps the audit list and all audit-detail
 * sub-routes (`[auditId]/…`). The §11 sync dot stays in the header.
 */
import { Stack } from 'expo-router';
import { SoteriaStrings } from '@soteria/core';
import { colors, fontWeight } from '../../../theme';
import { SyncStatusDot } from '../../../components/common/SyncStatusDot';

export default function AuditsLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary[800] },
        headerTintColor: colors.surface,
        headerTitleStyle: { fontWeight: fontWeight.bold },
        headerRight: () => <SyncStatusDot />,
      }}
    >
      <Stack.Screen name="index" options={{ title: SoteriaStrings.audit.listTitle }} />
      <Stack.Screen name="[auditId]/index" options={{ title: 'Audit overview' }} />
      <Stack.Screen name="[auditId]/plan" options={{ title: 'Audit plan' }} />
      <Stack.Screen
        name="[auditId]/clauses/index"
        options={{ title: SoteriaStrings.clauses.navigatorTitle }}
      />
      <Stack.Screen name="[auditId]/clauses/[clauseId]" options={{ title: 'Clause' }} />
      <Stack.Screen
        name="[auditId]/findings/index"
        options={{ title: SoteriaStrings.findings.listTitle }}
      />
      <Stack.Screen
        name="[auditId]/evidence/index"
        options={{ title: SoteriaStrings.evidence.listTitle }}
      />
      <Stack.Screen name="[auditId]/meetings/index" options={{ title: 'Meetings' }} />
      <Stack.Screen name="[auditId]/report" options={{ title: 'Report' }} />
    </Stack>
  );
}
