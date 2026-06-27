/**
 * Clause assessment (DESIGN_DOC §9.3) — the core field-audit screen.
 *
 * Pulls the canonical clause record (requirement text, audit focus, typical
 * questions, common nonconformities, expected documents) from
 * `@soteria/core/iso45001` (RULE 4 — never hardcoded). The auditor picks a
 * conformity status, writes notes, and marks the clause complete; saving writes
 * to WatermelonDB FIRST (RULE 9) and schedules a background sync.
 *
 * The clause score is derived from the auditor's verdicts via the shared
 * `clauseScoreFromVerdicts` util.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Divider, Text, TextInput } from 'react-native-paper';
import type { ConformityStatus } from '@soteria/core';
import { SoteriaStrings, clauseScoreFromVerdicts } from '@soteria/core';
import { getClauseByNumber } from '@soteria/core/iso45001';
import { Screen } from '../../../../../components/common/Screen';
import { EmptyState, LoadingState, SectionHeading } from '../../../../../components/common/StateViews';
import { ConformityPicker } from '../../../../../components/audit/ConformityPicker';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../../theme';
import { useClauseAssessment } from '../../../../../lib/useLocalData';
import { upsertClauseAssessment } from '../../../../../services/auditRepository';
import { useAuthStore } from '../../../../../stores/authStore';
import { useAuditStore } from '../../../../../stores/auditStore';

/** Map a chosen conformity status to a representative numeric score (0-100). */
function scoreForStatus(status: ConformityStatus): number {
  switch (status) {
    case 'conforming':
      return 100;
    case 'minor_nc':
      return 60;
    case 'major_nc':
      return 20;
    case 'not_applicable':
    case 'not_audited':
      return 0;
    default:
      return 0;
  }
}

export default function ClauseAssessmentScreen(): JSX.Element {
  const router = useRouter();
  const { auditId, clauseId } = useLocalSearchParams<{ auditId: string; clauseId: string }>();
  const { data: assessment, loading } = useClauseAssessment(auditId, clauseId);
  const auditorId = useAuthStore((s) => s.user?.uid ?? 'unknown');
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');
  const setActiveClause = useAuditStore((s) => s.setActiveClause);

  const clause = useMemo(() => getClauseByNumber(clauseId), [clauseId]);

  const [status, setStatus] = useState<ConformityStatus>('not_audited');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActiveClause(clauseId);
  }, [clauseId, setActiveClause]);

  // Hydrate local state from the persisted assessment once it loads.
  useEffect(() => {
    if (assessment !== null) {
      setStatus(assessment.conformityStatus);
      setNotes(assessment.auditorNotes);
    }
  }, [assessment]);

  if (clause === undefined) {
    return (
      <Screen name="clause-assessment">
        <EmptyState message={SoteriaStrings.errors.notFound} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen name="clause-assessment">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  const handleSave = async (markComplete: boolean): Promise<void> => {
    setSaving(true);
    try {
      const existingNotes = assessment?.subClauseNotes ?? [];
      // Prefer a verdict-derived score when sub-clause notes exist; otherwise
      // fall back to the status-representative score.
      const score =
        existingNotes.length > 0 ? clauseScoreFromVerdicts(existingNotes) : scoreForStatus(status);
      await upsertClauseAssessment({
        auditId,
        tenantId,
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        assignedAuditorId: auditorId,
        conformityStatus: status,
        score,
        auditorNotes: notes,
        subClauseNotes: existingNotes,
        isComplete: markComplete,
      });
      if (markComplete) {
        router.back();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen name="clause-assessment" scroll>
      <View style={styles.headerCard}>
        <Text style={styles.number}>{clause.number}</Text>
        <Text style={styles.title}>{clause.title}</Text>
      </View>

      <SectionHeading title="Requirement" />
      <Text style={styles.body}>{clause.requirementText}</Text>

      <SectionHeading title="Audit focus" />
      {clause.auditFocus.map((focus, i) => (
        <Bullet key={`focus-${i}`} text={focus} />
      ))}

      <SectionHeading title="Typical questions" />
      {clause.typicalAuditQuestions.map((q, i) => (
        <Bullet key={`q-${i}`} text={q} />
      ))}

      <SectionHeading title="Common nonconformities" />
      {clause.commonNonconformities.map((nc, i) => (
        <Bullet key={`nc-${i}`} text={nc} />
      ))}

      <SectionHeading title="Expected documents" />
      {clause.expectedDocuments.map((doc, i) => (
        <Bullet key={`doc-${i}`} text={doc} />
      ))}

      <Divider style={styles.divider} />

      <SectionHeading title={SoteriaStrings.clauses.conformityLabel} />
      <ConformityPicker value={status} onChange={setStatus} />

      <SectionHeading title={SoteriaStrings.clauses.notesLabel} />
      <TextInput
        mode="outlined"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={5}
        placeholder={SoteriaStrings.clauses.notesLabel}
      />

      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={(): void => {
            void handleSave(false);
          }}
          loading={saving}
          disabled={saving}
        >
          {SoteriaStrings.common.save}
        </Button>
        <Button
          mode="contained"
          onPress={(): void => {
            void handleSave(true);
          }}
          loading={saving}
          disabled={saving}
        >
          {SoteriaStrings.clauses.markComplete}
        </Button>
      </View>
    </Screen>
  );
}

function Bullet({ text }: { text: string }): JSX.Element {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { ...cardSurface, gap: spacing.xs },
  number: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  body: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  bulletDot: { color: colors.primary[500], fontSize: fontSize.md },
  bulletText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  divider: { marginVertical: spacing.lg },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg },
});
