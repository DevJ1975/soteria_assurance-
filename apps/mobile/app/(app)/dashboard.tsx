/**
 * Dashboard (DESIGN_DOC §9.9) — the auditor's at-a-glance home.
 *
 * Reads audits from the local WatermelonDB (offline-first), summarises status
 * counts and the aggregate findings, and links into the active audit. All copy
 * from SoteriaStrings (RULE 4); all color/spacing from tokens (RULE 5).
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native-paper';
import type { AuditStatus } from '@soteria/core';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../components/common/Screen';
import { EmptyState, LoadingState, SectionHeading } from '../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../theme';
import { useAudits } from '../../lib/useLocalData';
import { useAuthStore } from '../../stores/authStore';

const ACTIVE_STATUSES: AuditStatus[] = ['in_progress', 'findings_review', 'report_pending'];

export default function DashboardScreen(): JSX.Element {
  const router = useRouter();
  const { data: audits, loading } = useAudits();
  const displayName = useAuthStore((s) => s.user?.displayName ?? null);

  const stats = useMemo(() => {
    const active = audits.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;
    const planned = audits.filter((a) => a.status === 'planned').length;
    const findings = audits.reduce((sum, a) => sum + a.findingsSummary.totalFindings, 0);
    const openNCs = audits.reduce((sum, a) => sum + a.findingsSummary.openNCs, 0);
    return { active, planned, findings, openNCs };
  }, [audits]);

  if (loading) {
    return (
      <Screen name="dashboard">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="dashboard" scroll>
      <Text style={styles.greeting}>
        {displayName !== null ? `Welcome, ${displayName}` : SoteriaStrings.common.appName}
      </Text>

      <View style={styles.statRow}>
        <StatCard label="Active audits" value={stats.active} accent={colors.primary[500]} />
        <StatCard label="Planned" value={stats.planned} accent={colors.secondary[500]} />
      </View>
      <View style={styles.statRow}>
        <StatCard label="Total findings" value={stats.findings} accent={colors.ofi} />
        <StatCard label="Open NCs" value={stats.openNCs} accent={colors.majorNC} />
      </View>

      <SectionHeading title={SoteriaStrings.audit.listTitle} />
      {audits.length === 0 ? (
        <EmptyState message={SoteriaStrings.audit.noAudits} />
      ) : (
        audits.slice(0, 5).map((audit) => (
          <View key={audit.id} style={styles.auditRow}>
            <Text
              style={styles.auditNumber}
              onPress={(): void => router.push(`/(app)/audits/${audit.id}`)}
            >
              {audit.auditNumber}
            </Text>
            <Text style={styles.auditScope} numberOfLines={1}>
              {audit.scope}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}): JSX.Element {
  return (
    <View style={[styles.statCard, { borderLeftColor: accent }]}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[800],
    marginBottom: spacing.md,
  },
  statRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    ...cardSurface,
    flex: 1,
    borderLeftWidth: 4,
  },
  statValue: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  auditRow: {
    ...cardSurface,
    marginBottom: spacing.sm,
  },
  auditNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  auditScope: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
});
