/**
 * FindingForm — raise a new finding against the active clause (§9.3).
 *
 * Finding-type colors come from `@soteria/ui` (RULE 5) and labels/strings from
 * `@soteria/core` (RULE 4). The "Draft with AI" action calls the server-side
 * `draftNCR` callable (RULE 3) and the result is shown for auditor review with
 * the mandatory disclaimer (multi-agent-guide §8) before it is accepted into
 * the editable statement. Submitting writes locally first (RULE 9).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text, TextInput } from 'react-native-paper';
import {
  AI_DISCLAIMER,
  FINDING_TYPE_META,
  SoteriaStrings,
  type FindingType,
} from '@soteria/core';
import { getFindingColor } from '@soteria/ui';
import { colors, fontSize, fontWeight, spacing } from '../../theme';
import { draftNCR } from '../../services/aiService';

const TYPE_ORDER: FindingType[] = [
  'major_nc',
  'minor_nc',
  'ofi',
  'strong_point',
  'observation',
];

export interface FindingFormValues {
  type: FindingType;
  title: string;
  objectiveEvidence: string;
  nonconformityStatement: string;
  aiDraftStatement?: string;
}

interface Props {
  tenantId: string;
  clauseNumber: string;
  clauseTitle: string;
  requirementText: string;
  organizationContext: string;
  onSubmit: (values: FindingFormValues) => void | Promise<void>;
  submitting?: boolean;
}

export function FindingForm({
  tenantId,
  clauseNumber,
  clauseTitle,
  requirementText,
  organizationContext,
  onSubmit,
  submitting = false,
}: Props): JSX.Element {
  const [type, setType] = useState<FindingType>('minor_nc');
  const [title, setTitle] = useState('');
  const [objectiveEvidence, setObjectiveEvidence] = useState('');
  const [statement, setStatement] = useState('');
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiDraft = async (): Promise<void> => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await draftNCR({
        tenantId,
        clauseNumber,
        clauseTitle,
        requirementText,
        auditorRawNotes: objectiveEvidence,
        evidenceDescription: title,
        organizationContext,
      });
      const composed = [
        `REQUIREMENT: ${result.aiDraft.requirementStatement}`,
        `FINDING: ${result.aiDraft.findingStatement}`,
        `OBJECTIVE EVIDENCE: ${result.aiDraft.objectiveEvidenceStatement}`,
      ].join('\n\n');
      setAiDraft(composed);
    } catch {
      setAiError(SoteriaStrings.ai.unavailable);
    } finally {
      setAiBusy(false);
    }
  };

  const acceptAiDraft = (): void => {
    if (aiDraft !== null) {
      setStatement(aiDraft);
    }
  };

  const canSubmit =
    title.trim() !== '' && objectiveEvidence.trim() !== '' && !submitting;

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{SoteriaStrings.findings.typeLabel}</Text>
      <View style={styles.typeRow}>
        {TYPE_ORDER.map((t) => {
          const selected = t === type;
          const color = getFindingColor(t);
          return (
            <Chip
              key={t}
              selected={selected}
              onPress={(): void => setType(t)}
              style={[
                styles.chip,
                { borderColor: color },
                selected ? { backgroundColor: `${color}1A` } : null,
              ]}
              textStyle={{ color: selected ? color : colors.textSecondary }}
            >
              {FINDING_TYPE_META[t].code}
            </Chip>
          );
        })}
      </View>

      <TextInput
        mode="outlined"
        label={SoteriaStrings.findings.titleLabel}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        mode="outlined"
        label={SoteriaStrings.findings.objectiveEvidenceLabel}
        value={objectiveEvidence}
        onChangeText={setObjectiveEvidence}
        multiline
        numberOfLines={4}
      />

      <Button
        mode="outlined"
        icon="robot-outline"
        onPress={handleAiDraft}
        loading={aiBusy}
        disabled={aiBusy || objectiveEvidence.trim() === ''}
      >
        {SoteriaStrings.ai.draftNCR}
      </Button>
      {aiError !== null ? (
        <HelperText type="error" visible>
          {aiError}
        </HelperText>
      ) : null}

      {aiDraft !== null ? (
        <View style={styles.aiBox}>
          <Text style={styles.aiDisclaimer}>{AI_DISCLAIMER}</Text>
          <Text style={styles.aiText}>{aiDraft}</Text>
          <Button mode="text" onPress={acceptAiDraft}>
            Use this draft
          </Button>
        </View>
      ) : null}

      <TextInput
        mode="outlined"
        label={SoteriaStrings.findings.statementLabel}
        value={statement}
        onChangeText={setStatement}
        multiline
        numberOfLines={5}
      />

      <Button
        mode="contained"
        onPress={(): void => {
          void onSubmit({
            type,
            title: title.trim(),
            objectiveEvidence: objectiveEvidence.trim(),
            nonconformityStatement: statement.trim(),
            aiDraftStatement: aiDraft ?? undefined,
          });
        }}
        loading={submitting}
        disabled={!canSubmit}
        style={styles.submit}
      >
        {SoteriaStrings.findings.raiseFinding}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xl },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, backgroundColor: colors.surface },
  aiBox: {
    backgroundColor: colors.primary[50],
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
    padding: spacing.md,
    gap: spacing.sm,
  },
  aiDisclaimer: {
    fontSize: fontSize.xs,
    color: colors.secondary[600],
    fontWeight: fontWeight.semibold,
  },
  aiText: { fontSize: fontSize.sm, color: colors.textPrimary },
  submit: { marginTop: spacing.sm },
});
