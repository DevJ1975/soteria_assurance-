/**
 * Audit overview — the hub for a single audit. Surfaces status + the findings
 * summary and links into every audit module (plan, clauses, findings, evidence,
 * meetings, report). Hosts the AI co-pilot drawer (§9.4) and a FAB to open it.
 *
 * Reads the audit from the local DB (offline-first). Sets the audit active in
 * the session store so the field flow + recovery (RULE 8) know what is open.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FAB, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../../components/common/Screen';
import { LoadingState } from '../../../../components/common/StateViews';
import { AICopilotDrawer } from '../../../../components/ai/AICopilotDrawer';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../theme';
import { useAudit } from '../../../../lib/useLocalData';
import { auditStatusLabel, auditTypeLabel } from '../../../../lib/labels';
import { setAuditStatus } from '../../../../services/auditRepository';
import { useAuditStore } from '../../../../stores/auditStore';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

interface ModuleTile {
  label: string;
  icon: IconName;
  href: string;
}

export default function AuditOverviewScreen(): JSX.Element {
  const router = useRouter();
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: audit, loading } = useAudit(auditId);
  const setActiveAudit = useAuditStore((s) => s.setActiveAudit);
  const openCopilot = useAuditStore((s) => s.openCopilot);

  useEffect(() => {
    setActiveAudit(auditId);
  }, [auditId, setActiveAudit]);

  if (loading || audit === null) {
    return (
      <Screen name="audit-overview">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  const tiles: ModuleTile[] = [
    { label: 'Audit plan', icon: 'calendar-text', href: `/(app)/audits/${auditId}/plan` },
    {
      label: SoteriaStrings.clauses.navigatorTitle,
      icon: 'format-list-checks',
      href: `/(app)/audits/${auditId}/clauses`,
    },
    {
      label: SoteriaStrings.findings.listTitle,
      icon: 'alert-decagram-outline',
      href: `/(app)/audits/${auditId}/findings`,
    },
    {
      label: SoteriaStrings.evidence.listTitle,
      icon: 'camera-outline',
      href: `/(app)/audits/${auditId}/evidence`,
    },
    { label: 'Meetings', icon: 'account-group-outline', href: `/(app)/audits/${auditId}/meetings` },
    { label: 'Report', icon: 'file-document-outline', href: `/(app)/audits/${auditId}/report` },
  ];

  const summary = audit.findingsSummary;

  return (
    <Screen name="audit-overview" scroll>
      <View style={styles.headerCard}>
        <Text style={styles.auditNumber}>{audit.auditNumber}</Text>
        <Text style={styles.scope}>{audit.scope}</Text>
        <Text style={styles.meta}>
          {auditTypeLabel(audit.auditType)} · {auditStatusLabel(audit.status)}
        </Text>
        {audit.status === 'planned' ? (
          <Text
            style={styles.startAction}
            onPress={(): void => {
              void setAuditStatus(audit, 'in_progress');
            }}
          >
            {SoteriaStrings.audit.startAudit}
          </Text>
        ) : null}
      </View>

      <View style={styles.summaryRow}>
        <Summary label="Major NC" value={summary.majorNCs} color={colors.majorNC} />
        <Summary label="Minor NC" value={summary.minorNCs} color={colors.minorNC} />
        <Summary label="OFI" value={summary.ofis} color={colors.ofi} />
        <Summary label="SP" value={summary.strongPoints} color={colors.strongPoint} />
      </View>

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Text
            key={tile.href}
            style={styles.tile}
            onPress={(): void => router.push(tile.href)}
          >
            <MaterialCommunityIcons name={tile.icon} size={22} color={colors.primary[500]} />
            {`  ${tile.label}`}
          </Text>
        ))}
      </View>

      <AICopilotDrawer
        tenantId={audit.tenantId}
        industry="Manufacturing"
        intervieweeRole="OH&S Manager"
      />
      <FAB
        icon="robot-outline"
        label={SoteriaStrings.ai.copilotTitle}
        onPress={openCopilot}
        style={styles.fab}
        color={colors.surface}
      />
    </Screen>
  );
}

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): JSX.Element {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { ...cardSurface, gap: spacing.xs },
  auditNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  scope: { fontSize: fontSize.md, color: colors.textPrimary },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary },
  startAction: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.conforming,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  summaryCell: { ...cardSurface, flex: 1, alignItems: 'center', padding: spacing.sm },
  summaryValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  grid: { marginTop: spacing.lg, gap: spacing.sm },
  tile: {
    ...cardSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    backgroundColor: colors.primary[500],
  },
});
