/**
 * AICopilotDrawer (DESIGN_DOC §9.4) — ARIA co-pilot bottom sheet.
 *
 * Open state lives in the audit store ({@link useAuditStore}). The drawer offers
 * the two Phase-1 AI actions wired to server-side callables (RULE 3):
 * draft NCR and suggest interview questions for the active clause. Every result
 * is shown with the mandatory disclaimer (multi-agent-guide §8) and is treated
 * as an auditor-reviewed draft. Strings from SoteriaStrings (RULE 4).
 */
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, HelperText, IconButton, Text } from 'react-native-paper';
import { AI_DISCLAIMER, SoteriaStrings } from '@soteria/core';
import { getClauseByNumber } from '@soteria/core/iso45001';
import { colors, fontSize, fontWeight, spacing } from '../../theme';
import { useAuditStore } from '../../stores/auditStore';
import { suggestQuestions } from '../../services/aiService';

interface Props {
  tenantId: string;
  /** Industry of the audited org (for tailored questions). */
  industry: string;
  intervieweeRole: string;
}

export function AICopilotDrawer({ tenantId, industry, intervieweeRole }: Props): JSX.Element {
  const isOpen = useAuditStore((s) => s.isCopilotOpen);
  const close = useAuditStore((s) => s.closeCopilot);
  const clauseNumber = useAuditStore((s) => s.activeClauseNumber);

  const [questions, setQuestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clause = clauseNumber !== null ? getClauseByNumber(clauseNumber) : undefined;

  const handleSuggest = async (): Promise<void> => {
    if (clause === undefined) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await suggestQuestions({
        tenantId,
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        intervieweeRole,
        industry,
      });
      setQuestions(result.questions);
    } catch {
      setError(SoteriaStrings.ai.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{SoteriaStrings.ai.copilotTitle}</Text>
            <IconButton icon="close" onPress={close} accessibilityLabel={SoteriaStrings.common.close} />
          </View>
          <Text style={styles.disclaimer}>{AI_DISCLAIMER}</Text>
          <Divider style={styles.divider} />

          {clause !== undefined ? (
            <Text style={styles.context}>
              {clause.number} — {clause.title}
            </Text>
          ) : (
            <Text style={styles.context}>Open a clause to get tailored assistance.</Text>
          )}

          <Button
            mode="contained"
            icon="comment-question-outline"
            onPress={handleSuggest}
            loading={busy}
            disabled={busy || clause === undefined}
            style={styles.action}
          >
            {SoteriaStrings.ai.suggestQuestions}
          </Button>

          {error !== null ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}

          <ScrollView style={styles.results}>
            {questions.map((q, i) => (
              <View key={`${i}-${q.slice(0, 12)}`} style={styles.question}>
                <Text style={styles.questionIndex}>{i + 1}.</Text>
                <Text style={styles.questionText}>{q}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,38,71,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.md,
    borderTopRightRadius: spacing.md,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary[800] },
  disclaimer: {
    fontSize: fontSize.xs,
    color: colors.secondary[600],
    fontWeight: fontWeight.semibold,
  },
  divider: { marginVertical: spacing.sm },
  context: { fontSize: fontSize.md, color: colors.textPrimary, marginBottom: spacing.sm },
  action: { marginVertical: spacing.sm },
  results: { marginTop: spacing.sm },
  question: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  questionIndex: { fontWeight: fontWeight.bold, color: colors.primary[500] },
  questionText: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
});
