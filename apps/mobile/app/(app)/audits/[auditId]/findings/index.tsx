/**
 * Findings (DESIGN_DOC §9.3) — list the audit's findings and raise a new one.
 *
 * Raising uses {@link FindingForm} (which can draft with AI server-side) and
 * writes locally first via the repository (RULE 9). The new finding number is
 * sequenced from the current local count. Status changes go through the
 * repository too. All copy from SoteriaStrings; colors via the badge tokens.
 */
import { useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, IconButton, Text } from 'react-native-paper';
import { SoteriaStrings } from '@soteria/core';
import { getClauseByNumber } from '@soteria/core/iso45001';
import { Screen } from '../../../../../components/common/Screen';
import { EmptyState, LoadingState } from '../../../../../components/common/StateViews';
import { FindingForm, type FindingFormValues } from '../../../../../components/findings/FindingForm';
import { FindingTypeBadge } from '../../../../../components/findings/FindingTypeBadge';
import { cardSurface, colors, fontSize, fontWeight, spacing } from '../../../../../theme';
import { useAudit, useFindings } from '../../../../../lib/useLocalData';
import { createFinding } from '../../../../../services/auditRepository';
import { useAuthStore } from '../../../../../stores/authStore';
import { useAuditStore } from '../../../../../stores/auditStore';

export default function FindingsScreen(): JSX.Element {
  const { auditId } = useLocalSearchParams<{ auditId: string }>();
  const { data: audit } = useAudit(auditId);
  const { data: findings, loading } = useFindings(auditId);
  const activeClause = useAuditStore((s) => s.activeClauseNumber);
  const user = useAuthStore((s) => s.user);
  const tenantId = useAuthStore((s) => s.claims?.tenantId ?? '');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clause = activeClause !== null ? getClauseByNumber(activeClause) : undefined;

  const handleSubmit = async (values: FindingFormValues): Promise<void> => {
    if (audit === null || user === null) {
      return;
    }
    setSubmitting(true);
    try {
      await createFinding({
        auditId,
        tenantId,
        clientId: audit.clientId,
        type: values.type,
        clauseNumber: clause?.number ?? '4',
        clauseTitle: clause?.title ?? 'Context of the Organization',
        requirement: clause?.requirementText ?? '',
        title: values.title,
        objectiveEvidence: values.objectiveEvidence,
        nonconformityStatement: values.nonconformityStatement,
        aiDraftStatement: values.aiDraftStatement,
        raisedByAuditorId: user.uid,
        raisedByAuditorName: user.displayName ?? user.email ?? 'Auditor',
        sequence: findings.length + 1,
      });
      setFormOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen name="findings">
        <LoadingState label={SoteriaStrings.common.loading} />
      </Screen>
    );
  }

  return (
    <Screen name="findings">
      <Button
        mode="contained"
        icon="plus"
        onPress={(): void => setFormOpen(true)}
        style={styles.newButton}
      >
        {SoteriaStrings.findings.newFinding}
      </Button>

      {findings.length === 0 ? (
        <EmptyState message={SoteriaStrings.findings.noFindings} />
      ) : (
        <FlatList
          data={findings}
          keyExtractor={(item): string => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }): JSX.Element => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.findingNumber}>{item.findingNumber}</Text>
                <FindingTypeBadge type={item.type} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.clause}>
                Clause {item.clauseNumber} — {item.clauseTitle}
              </Text>
              {item.targetClosureDate !== null ? (
                <Text style={styles.due}>Target closure: {item.targetClosureDate}</Text>
              ) : null}
            </View>
          )}
        />
      )}

      <Modal
        visible={formOpen}
        animationType="slide"
        onRequestClose={(): void => setFormOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{SoteriaStrings.findings.newFinding}</Text>
            <IconButton
              icon="close"
              onPress={(): void => setFormOpen(false)}
              accessibilityLabel={SoteriaStrings.common.close}
            />
          </View>
          <View style={styles.modalBody}>
            <FindingForm
              tenantId={tenantId}
              clauseNumber={clause?.number ?? '4'}
              clauseTitle={clause?.title ?? 'Context of the Organization'}
              requirementText={clause?.requirementText ?? ''}
              organizationContext={audit?.scope ?? ''}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  newButton: { marginBottom: spacing.md },
  list: { paddingBottom: spacing.xl },
  card: { ...cardSurface, marginBottom: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  findingNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary[500],
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.textPrimary },
  clause: { fontSize: fontSize.sm, color: colors.textSecondary },
  due: { fontSize: fontSize.sm, color: colors.warning, fontWeight: fontWeight.medium },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: colors.primary[800],
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.surface },
  modalBody: { flex: 1, padding: spacing.md },
});
