/**
 * Audit plan (DESIGN_DOC §9.1) — read view of the agreed audit plan: timed
 * activities, interviewees, and inspection areas. The plan is part of the
 * `Audit` document (`auditPlan`), read from the local DB.
 */
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { Screen } from '../../../../components/common/Screen';
import { EmptyState, LoadingState, SectionHeading } from '../../../../components/common/StateViews';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../theme';
import { useAudit } from '../../../../lib/useLocalData';

export default function AuditPlanScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: audit, loading } = useAudit(auditId);

  if (loading || audit === null) {
    return (
      <Screen name="audit-plan">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  const plan = audit.auditPlan;
  const hasActivities = plan.activities.length > 0;

  return (
    <Screen name="audit-plan" scroll>
      <SectionHeading title="Schedule" />
      {hasActivities ? (
        plan.activities.map((activity) => (
          <View key={activity.activityId} style={styles.row}>
            <Text style={styles.time}>{activity.time}</Text>
            <View style={styles.rowBody}>
              <Text style={styles.activity}>{activity.activity}</Text>
              <Text style={styles.detail}>
                {activity.location} · {activity.duration} min
                {activity.clauses.length > 0 ? ` · Clauses ${activity.clauses.join(', ')}` : ''}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState message="No plan activities scheduled yet." />
      )}

      <SectionHeading title="Interviewees" />
      {plan.intervieweeList.length > 0 ? (
        plan.intervieweeList.map((person) => (
          <View key={person.intervieweeId} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.activity}>{person.name}</Text>
              <Text style={styles.detail}>
                {person.jobTitle} · {person.department}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState message="No interviewees listed." />
      )}

      <SectionHeading title="Inspection areas" />
      {plan.areaInspectionList.length > 0 ? (
        plan.areaInspectionList.map((area) => (
          <View key={area.areaId} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.activity}>{area.name}</Text>
              <Text style={styles.detail}>
                {area.hazards.length > 0 ? `Hazards: ${area.hazards.join(', ')}` : 'No hazards listed'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState message="No inspection areas listed." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { ...cardSurface, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  time: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
    width: 56,
  },
  rowBody: { flex: 1, gap: spacing.xs },
  activity: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  detail: { fontSize: fontSize.sm, color: colors.textSecondary },
});
