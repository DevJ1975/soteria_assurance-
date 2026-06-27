/**
 * Main app tab navigator (DESIGN_DOC §11 bottom navigation).
 *
 * Tabs: Dashboard, Audits, Clients, CAs, Wiki, Settings. The always-visible
 * §11 sync-status dot lives in the header right. The audit detail sub-routes
 * (`audits/[auditId]/…`) are nested under the Audits tab via a stack.
 *
 * Tab/header colors come from Soteria tokens (RULE 5) and labels from
 * SoteriaStrings (RULE 4).
 */
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SoteriaStrings } from '@soteria/core';
import { colors, fontWeight } from '../../theme';
import { SyncStatusDot } from '../../components/common/SyncStatusDot';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }): JSX.Element => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

export default function AppLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary[800] },
        headerTintColor: colors.surface,
        headerTitleStyle: { fontWeight: fontWeight.bold },
        headerRight: () => <SyncStatusDot />,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('view-dashboard-outline') }}
      />
      <Tabs.Screen
        name="audits"
        options={{
          title: SoteriaStrings.audit.listTitle,
          headerShown: false,
          tabBarIcon: tabIcon('clipboard-check-outline'),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{ title: 'Clients', tabBarIcon: tabIcon('domain') }}
      />
      <Tabs.Screen
        name="corrective-actions"
        options={{ title: 'CAs', tabBarIcon: tabIcon('wrench-outline') }}
      />
      <Tabs.Screen
        name="wiki"
        options={{ title: 'Wiki', tabBarIcon: tabIcon('book-open-variant') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('cog-outline') }}
      />
    </Tabs>
  );
}
