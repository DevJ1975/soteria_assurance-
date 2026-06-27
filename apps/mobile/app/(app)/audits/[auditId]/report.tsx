/**
 * Report (DESIGN_DOC §9.7) — a live pre-report summary computed entirely from
 * local data: the findings summary (`computeFindingsSummary`) and the
 * certification-readiness score (`computeCertificationReadinessScore`), both
 * from `@soteria/core` so the math is identical to the backend report
 * generator. The PDF itself is produced server-side (`generateReport`); this
 * screen is the auditor's on-device preview before issuing.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native-paper';
import type {
  ClauseAssessment as ClauseDoc,
  Finding as FindingDoc,
} from '@soteria/core';
import {
  SoteriaStrings,
  computeCertificationReadinessScore,
  computeFindingsSummary,
} from '@soteria/core';
import { Screen } from '../../../../components/common/Screen';
import { LoadingState, SectionHeading } from '../../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../theme';
import { useClauseAssessments, useFindings } from '../../../../lib/useLocalData';

export default function ReportScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: findings, loading: findingsLoading } = useFindings(auditId);
  const { data: assessments, loading: clausesLoading } = useClauseAssessments(auditId);

  const summary = useMemo(
    // The core summariser reads only `type` + `status`; project the local rows
    // to that minimal Finding shape rather than building full documents.
    () =>
      computeFindingsSummary(
        findings.map((f) => ({ type: f.type, status: f.status }) as FindingDoc),
      ),
    [findings],
  );

  const readiness = useMemo(
    // The readiness scorer reads only `conformityStatus` + `score`.
    () =>
      computeCertificationReadinessScore(
        assessments.map(
          (a) => ({ conformityStatus: a.conformityStatus, score: a.score }) as ClauseDoc,
        ),
      ),
    [assessments],
  );

  if (findingsLoading || clausesLoading) {
    return (
      <Screen name="report">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="report" scroll>
      <View style={styles.readinessCard}>
        <Text style={styles.readinessValue}>{readiness}%</Text>
        <Text style={styles.readinessLabel}>{SoteriaStrings.audit.certificationReadiness}</Text>
      </View>

      <SectionHeading title={SoteriaStrings.findings.listTitle} />
      <View style={styles.grid}>
        <Stat label="Total" value={summary.totalFindings} color={colors.primary[500]} />
        <Stat label="Major NC" value={summary.majorNCs} color={colors.majorNC} />
        <Stat label="Minor NC" value={summary.minorNCs} color={colors.minorNC} />
        <Stat label="OFI" value={summary.ofis} color={colors.ofi} />
        <Stat label="Strong point" value={summary.strongPoints} color={colors.strongPoint} />
        <Stat label="Observation" value={summary.observations} color={colors.textSecondary} />
        <Stat label="Open NCs" value={summary.openNCs} color={colors.warning} />
        <Stat label="Closed NCs" value={summary.closedNCs} color={colors.conforming} />
      </View>
    </Screen>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): JSX.Element {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readinessCard: { ...cardSurface, alignItems: 'center', paddingVertical: spacing.xl },
  readinessValue: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.gold[600],
  },
  readinessLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    ...cardSurface,
    width: '47%',
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  statLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
});
