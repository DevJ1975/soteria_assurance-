'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  SoteriaStrings,
  CONFORMITY_STATUS_META,
  clauseScoreFromVerdicts,
  getClauseByNumber,
  type ClauseAssessment,
  type ConformityStatus,
  type ConformityVerdict,
  type StandardId,
  type SubClauseNote,
} from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useSaveClauseAssessment } from '@/lib/hooks';

const CONFORMITY_STATUSES = Object.keys(CONFORMITY_STATUS_META) as ConformityStatus[];

const VERDICT_LABELS: Record<ConformityVerdict, string> = {
  yes: 'Conforms',
  partial: 'Partial',
  no: 'Does not conform',
  na: 'Not applicable',
};

/**
 * Builds the starting sub-clause notes for a clause that has never been
 * assessed, from the canonical ISO 45001 dataset (RULE 4 — clause text is
 * never hardcoded in the UI). An existing assessment keeps its own notes so an
 * auditor's wording is never overwritten by the template.
 */
function seedSubClauseNotes(standardId: StandardId, clauseNumber: string): SubClauseNote[] {
  const clause = getClauseByNumber(standardId, clauseNumber);
  if (!clause) return [];
  return clause.typicalAuditQuestions.map((auditQuestion) => ({
    subClauseNumber: clause.number,
    requirementText: clause.requirementText,
    auditQuestion,
    auditorResponse: '',
    conformityVerdict: 'na' as ConformityVerdict,
  }));
}

export interface ClauseAssessmentEditorProps {
  auditId: string;
  /** The audit's standard — a clause number is ambiguous without it. */
  standardId: StandardId;
  clauseNumber: string;
  /** The saved assessment for this clause, or `undefined` if never assessed. */
  assessment: ClauseAssessment | undefined;
}

/**
 * Records the assessment of a single ISO 45001 clause: a verdict and response
 * per audit question, an overall conformity status, and the auditor's notes.
 *
 * The overall score is derived from the sub-clause verdicts rather than typed
 * in, so the number in the report always matches the evidence behind it.
 */
export function ClauseAssessmentEditor({
  auditId,
  standardId,
  clauseNumber,
  assessment,
}: ClauseAssessmentEditorProps) {
  const clause = getClauseByNumber(standardId, clauseNumber);
  const save = useSaveClauseAssessment(auditId);

  const [notes, setNotes] = useState<SubClauseNote[]>([]);
  const [status, setStatus] = useState<ConformityStatus>('not_audited');
  const [auditorNotes, setAuditorNotes] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Reloading on clause change (and on the saved row arriving) keeps the form
  // showing the persisted assessment rather than the previous clause's edits.
  useEffect(() => {
    setNotes(
      assessment?.subClauseNotes.length
        ? assessment.subClauseNotes
        : seedSubClauseNotes(standardId, clauseNumber),
    );
    setStatus(assessment?.conformityStatus ?? 'not_audited');
    setAuditorNotes(assessment?.auditorNotes ?? '');
    setIsComplete(assessment?.isComplete ?? false);
  }, [assessment, clauseNumber, standardId]);

  const score = useMemo(() => clauseScoreFromVerdicts(notes), [notes]);

  function updateNote(index: number, patch: Partial<SubClauseNote>) {
    setNotes((current) =>
      current.map((note, i) => (i === index ? { ...note, ...patch } : note)),
    );
  }

  function handleSave() {
    if (!clause) return;
    save.mutate({
      standardId,
      clauseNumber: clause.number,
      clauseTitle: clause.title,
      conformityStatus: status,
      score,
      auditorNotes,
      subClauseNotes: notes,
      evidenceIds: assessment?.evidenceIds ?? [],
      findingIds: assessment?.findingIds ?? [],
      assignedAuditorId: assessment?.assignedAuditorId,
      isComplete,
    });
  }

  if (!clause) {
    return <ErrorState message={SoteriaStrings.errors.notFound} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="font-mono text-primary-700">{clause.number}</span> {clause.title}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-lg">
          <p className="text-sm text-text-secondary">{clause.requirementText}</p>

          {clause.auditFocus.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-text-secondary">What to look for</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-text-secondary">
                {clause.auditFocus.map((focus) => (
                  <li key={focus}>{focus}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col gap-md">
            {notes.map((note, index) => (
              <div
                key={`${note.subClauseNumber}-${note.auditQuestion}`}
                className="flex flex-col gap-sm rounded-md border border-border-soft p-md"
              >
                <p className="text-sm font-medium text-text-primary">{note.auditQuestion}</p>
                <Textarea
                  id={`response-${index}`}
                  label="Auditor response"
                  value={note.auditorResponse}
                  onChange={(event) => updateNote(index, { auditorResponse: event.target.value })}
                />
                <Select
                  id={`verdict-${index}`}
                  label="Verdict"
                  value={note.conformityVerdict}
                  onChange={(event) =>
                    updateNote(index, {
                      conformityVerdict: event.target.value as ConformityVerdict,
                    })
                  }
                >
                  {(Object.keys(VERDICT_LABELS) as ConformityVerdict[]).map((verdict) => (
                    <option key={verdict} value={verdict}>
                      {VERDICT_LABELS[verdict]}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <div className="grid gap-md sm:grid-cols-2">
            <Select
              id="conformity-status"
              label={SoteriaStrings.clauses.conformityLabel}
              value={status}
              onChange={(event) => setStatus(event.target.value as ConformityStatus)}
            >
              {CONFORMITY_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CONFORMITY_STATUS_META[value].label}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-secondary">
                {SoteriaStrings.clauses.scoreLabel}
              </span>
              <output className="text-2xl font-bold text-primary-800">{score}%</output>
              <span className="text-xs text-text-muted">
                Derived from the verdicts above; &ldquo;not applicable&rdquo; answers are excluded.
              </span>
            </div>
          </div>

          <Textarea
            id="auditor-notes"
            label={SoteriaStrings.clauses.notesLabel}
            value={auditorNotes}
            onChange={(event) => setAuditorNotes(event.target.value)}
          />

          <label className="inline-flex items-center gap-sm text-sm text-text-primary">
            <input
              type="checkbox"
              checked={isComplete}
              onChange={(event) => setIsComplete(event.target.checked)}
              className="h-4 w-4 rounded border-border-soft"
            />
            {SoteriaStrings.clauses.markComplete}
          </label>

          {save.isError ? <ErrorState message={SoteriaStrings.errors.generic} /> : null}

          <div className="flex items-center gap-md">
            <Button onClick={handleSave} loading={save.isPending}>
              <Save className="h-4 w-4" aria-hidden />
              {SoteriaStrings.common.save}
            </Button>
            {save.isSuccess && !save.isPending ? (
              <span className="text-sm text-conforming">{SoteriaStrings.common.synced}</span>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
