'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { Plus, Sparkles } from 'lucide-react';
import {
  SoteriaStrings,
  FINDING_TYPE_META,
  AI_DISCLAIMER,
  type Finding,
  type FindingType,
} from '@soteria/core';
import { findingsCol, setDocById } from '@soteria/firebase';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FindingTypeBadge } from '@/components/FindingTypeBadge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useFindings, useTenantId } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { callDraftNCR } from '@/lib/firebase';

const FINDING_TYPES = Object.keys(FINDING_TYPE_META) as FindingType[];

function FindingsView() {
  const params = useSearchParams();
  const auditId = params.get('id') ?? '';
  const tenantId = useTenantId();
  const { user } = useAuth();
  const findingsQuery = useFindings(auditId);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<FindingType>('minor_nc');
  const [clauseNumber, setClauseNumber] = useState('6.1.2');
  const [clauseTitle, setClauseTitle] = useState('Hazard identification and assessment');
  const [title, setTitle] = useState('');
  const [objectiveEvidence, setObjectiveEvidence] = useState('');
  const [statement, setStatement] = useState('');
  const [requirement, setRequirement] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  if (auditId === '') {
    return <EmptyState message={SoteriaStrings.errors.notFound} />;
  }

  async function handleAIDraft() {
    if (tenantId === '') {
      setError(SoteriaStrings.errors.permissionDenied);
      return;
    }
    setDrafting(true);
    setError(null);
    setAiNotice(null);
    try {
      const result = await callDraftNCR({
        tenantId,
        clauseNumber,
        clauseTitle,
        requirementText: requirement || clauseTitle,
        auditorRawNotes: objectiveEvidence || title,
        organizationContext: 'ISO 45001:2018 certification audit',
      });
      setTitle(result.aiDraft.ncrTitle);
      setStatement(result.aiDraft.findingStatement);
      setObjectiveEvidence(result.aiDraft.objectiveEvidenceStatement);
      setRequirement(result.aiDraft.requirementStatement);
      setType(result.aiDraft.suggestedSeverity === 'major' ? 'major_nc' : 'minor_nc');
      // Mandatory disclaimer surfaced on every AI draft.
      setAiNotice(result.disclaimer ?? AI_DISCLAIMER);
    } catch {
      setError(SoteriaStrings.ai.unavailable);
    } finally {
      setDrafting(false);
    }
  }

  async function handleSave() {
    if (tenantId === '') {
      setError(SoteriaStrings.errors.permissionDenied);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const col = findingsCol(tenantId, auditId);
      const id = crypto.randomUUID();
      const now = Timestamp.now();
      const isNC = type === 'major_nc' || type === 'minor_nc';
      const finding: Finding = {
        id,
        auditId,
        tenantId,
        clientId: '',
        findingNumber: `NCR-${new Date().getFullYear()}-${String(
          Math.floor(Math.random() * 900) + 1,
        ).padStart(3, '0')}`,
        type,
        ...(isNC ? { severity: type === 'major_nc' ? 'major' : 'minor' } : {}),
        clauseNumber,
        clauseTitle,
        requirement: requirement || clauseTitle,
        title,
        objectiveEvidence,
        nonconformityStatement: statement,
        evidenceIds: [],
        raisedByAuditorId: user?.uid ?? '',
        raisedByAuditorName: user?.displayName ?? user?.email ?? '',
        raisedAt: now,
        status: 'open',
        updatedAt: now,
      };
      await setDocById(col, finding);
      setShowForm(false);
      setTitle('');
      setObjectiveEvidence('');
      setStatement('');
      setAiNotice(null);
      void findingsQuery.refetch();
    } catch {
      setError(SoteriaStrings.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
          {SoteriaStrings.findings.listTitle}
        </h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" aria-hidden />
          {SoteriaStrings.findings.newFinding}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{SoteriaStrings.findings.newFinding}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-md">
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <Select
                id="finding-type"
                label={SoteriaStrings.findings.typeLabel}
                value={type}
                onChange={(e) => setType(e.target.value as FindingType)}
              >
                {FINDING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FINDING_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
              <Input
                id="finding-clause"
                label={SoteriaStrings.findings.clauseLabel}
                value={clauseNumber}
                onChange={(e) => setClauseNumber(e.target.value)}
              />
            </div>
            <Input
              id="finding-clause-title"
              label="Clause title"
              value={clauseTitle}
              onChange={(e) => setClauseTitle(e.target.value)}
            />
            <Input
              id="finding-title"
              label={SoteriaStrings.findings.titleLabel}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              id="finding-evidence"
              label={SoteriaStrings.findings.objectiveEvidenceLabel}
              value={objectiveEvidence}
              onChange={(e) => setObjectiveEvidence(e.target.value)}
            />
            <Textarea
              id="finding-statement"
              label={SoteriaStrings.findings.statementLabel}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />

            {aiNotice ? (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-md py-2 text-xs text-warning">
                {aiNotice}
              </p>
            ) : null}
            {error ? <ErrorState message={error} /> : null}

            <div className="flex flex-wrap justify-between gap-sm">
              <Button variant="outline" onClick={() => void handleAIDraft()} loading={drafting}>
                <Sparkles className="h-4 w-4" aria-hidden />
                {SoteriaStrings.ai.draftNCR}
              </Button>
              <div className="flex gap-sm">
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  {SoteriaStrings.common.cancel}
                </Button>
                <Button onClick={() => void handleSave()} loading={saving} disabled={title === ''}>
                  {SoteriaStrings.findings.raiseFinding}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {findingsQuery.isLoading ? (
        <LoadingState />
      ) : findingsQuery.isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (findingsQuery.data ?? []).length === 0 ? (
        <EmptyState message={SoteriaStrings.findings.noFindings} />
      ) : (
        <div className="flex flex-col gap-md">
          {(findingsQuery.data ?? []).map((finding) => (
            <Card key={finding.id}>
              <CardBody className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-sm">
                    <FindingTypeBadge type={finding.type} />
                    <span className="font-mono text-sm text-primary-700">
                      {finding.findingNumber}
                    </span>
                  </span>
                  <span className="text-xs text-text-muted">{finding.status}</span>
                </div>
                <p className="font-medium text-text-primary">{finding.title}</p>
                <p className="text-sm text-text-secondary">{finding.nonconformityStatement}</p>
                <p className="font-mono text-xs text-text-muted">
                  {finding.clauseNumber} · {finding.clauseTitle}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FindingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FindingsView />
    </Suspense>
  );
}
