'use client';

import { useState } from 'react';
import { SoteriaStrings } from '@soteria/core';
import type { Audit, AuditorDeclaration } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import { useAuth } from '@/lib/auth-context';
import {
  useCreateProgramme,
  useDeclarations,
  useDeclare,
  useProgrammes,
  useReviewDeclaration,
  useUpdateAudit,
} from '@/lib/hooks';

/**
 * The two records an accreditation assessor asks for first, and that the data
 * model previously could not produce: the certification cycle this audit
 * belongs to, and each team member's competence and impartiality declaration
 * for THIS engagement (ISO/IEC 17021-1 §5.2, §7.1–7.2, §9.1.2).
 *
 * Independence is enforced by the database, not by this form: a declaration
 * cannot be reviewed by its own declarant, and a certification decision cannot
 * be recorded by anyone who sat on the cycle's audit team. The form just
 * surfaces those refusals as errors.
 */
export function GovernancePanel({ audit }: { audit: Audit }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certification cycle and team declarations</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-lg">
        <ProgrammeSection audit={audit} />
        <DeclarationsSection audit={audit} />
      </CardBody>
    </Card>
  );
}

function ProgrammeSection({ audit }: { audit: Audit }) {
  const { data: programmes } = useProgrammes();
  const updateAudit = useUpdateAudit();
  const createProgramme = useCreateProgramme();
  const [creating, setCreating] = useState(false);
  const [cycleStart, setCycleStart] = useState(audit.plannedStartDate);
  const [error, setError] = useState<string | null>(null);

  const forClient = (programmes ?? []).filter(
    (programme) => programme.clientId === audit.clientId && programme.standardId === audit.standardId,
  );
  const linked = forClient.find((programme) => programme.id === audit.programmeId);

  async function link(programmeId: string) {
    setError(null);
    try {
      await updateAudit.mutateAsync({
        auditId: audit.id,
        patch: { programmeId: programmeId === '' ? undefined : programmeId },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  async function create() {
    setError(null);
    try {
      const start = new Date(cycleStart);
      const end = new Date(start);
      // A certification cycle is three years (ISO/IEC 17021-1 §9.1.2).
      end.setFullYear(end.getFullYear() + 3);
      const id = crypto.randomUUID();
      await createProgramme.mutateAsync({
        id,
        clientId: audit.clientId,
        standardId: audit.standardId,
        cycleStart: start.toISOString().slice(0, 10),
        cycleEnd: end.toISOString().slice(0, 10),
        notes: '',
      });
      await updateAudit.mutateAsync({ auditId: audit.id, patch: { programmeId: id } });
      setCreating(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  const needsProgramme =
    audit.auditType === 'initial_certification' ||
    audit.auditType === 'surveillance' ||
    audit.auditType === 'recertification';

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <span className="text-sm font-medium text-text-primary">Certification cycle</span>
        {linked !== undefined ? (
          <Badge tone="conforming">
            {linked.cycleStart} → {linked.cycleEnd} · {linked.certificationDecision}
          </Badge>
        ) : needsProgramme ? (
          <Badge tone="minor-nc">Not linked to a cycle</Badge>
        ) : (
          <Badge tone="neutral">Not applicable</Badge>
        )}
      </div>

      {needsProgramme && linked === undefined ? (
        <p className="text-xs text-text-muted">
          A {audit.auditType.replace(/_/g, ' ')} audit belongs to a certification cycle. Without the
          link, this audit has no traceable relationship to the certification decision it supports.
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-end gap-sm md:grid-cols-[2fr_auto]">
        <Select
          label="Link to cycle"
          value={audit.programmeId ?? ''}
          onChange={(event) => link(event.target.value)}
        >
          <option value="">— none —</option>
          {forClient.map((programme) => (
            <option key={programme.id} value={programme.id}>
              {programme.cycleStart} → {programme.cycleEnd} ({programme.certificationDecision})
            </option>
          ))}
        </Select>
        <Button size="sm" variant="secondary" onClick={() => setCreating(!creating)}>
          New cycle
        </Button>
      </div>

      {creating ? (
        <div className="grid grid-cols-1 items-end gap-sm md:grid-cols-[1fr_auto]">
          <Input
            label="Cycle starts (3-year cycle)"
            type="date"
            value={cycleStart}
            onChange={(event) => setCycleStart(event.target.value)}
          />
          <Button size="sm" loading={createProgramme.isPending} onClick={create}>
            Create and link
          </Button>
        </div>
      ) : null}

      {error !== null ? <ErrorState message={error} /> : null}
    </div>
  );
}

function DeclarationsSection({ audit }: { audit: Audit }) {
  const { user } = useAuth();
  const { data: declarations } = useDeclarations(audit.id);
  const declare = useDeclare(audit.id);
  const review = useReviewDeclaration(audit.id);

  const [competence, setCompetence] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [conflict, setConflict] = useState('');
  const [mitigation, setMitigation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const myId = user?.id ?? '';
  const myName = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? '';
  const mine = (declarations ?? []).find((declaration) => declaration.auditorId === myId);

  // Everyone on the audit, whether or not they have declared yet.
  const team = [
    ...(audit.leadAuditorId ? [{ userId: audit.leadAuditorId, displayName: 'Lead auditor' }] : []),
    ...audit.auditTeam.map((member) => ({ userId: member.userId, displayName: member.displayName })),
  ];
  const declaredIds = new Set((declarations ?? []).map((declaration) => declaration.auditorId));
  const outstanding = team.filter((member) => !declaredIds.has(member.userId));

  async function submit() {
    setError(null);
    if (competence.trim() === '') {
      setError('State why you are competent for this audit — sector, scope, qualification.');
      return;
    }
    if (hasConflict && conflict.trim() === '') {
      setError('Describe the conflict.');
      return;
    }
    try {
      await declare.mutateAsync({
        auditId: audit.id,
        auditorId: myId,
        auditorName: myName,
        competenceStatement: competence.trim(),
        hasConflict,
        conflictDetails: hasConflict ? conflict.trim() : '',
        mitigation: hasConflict ? mitigation.trim() : '',
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  async function decide(declaration: AuditorDeclaration, outcome: 'accepted' | 'rejected') {
    setError(null);
    try {
      await review.mutateAsync({
        declarationId: declaration.id,
        input: { reviewerId: myId, reviewerName: myName, outcome },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SoteriaStrings.errors.network);
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-sm">
        <span className="text-sm font-medium text-text-primary">Team declarations</span>
        {outstanding.length > 0 ? (
          <Badge tone="minor-nc">{outstanding.length} outstanding</Badge>
        ) : (declarations ?? []).length > 0 ? (
          <Badge tone="conforming">All declared</Badge>
        ) : null}
      </div>

      {(declarations ?? []).map((declaration) => (
        <div
          key={declaration.id}
          className="flex flex-col gap-1 rounded-md border border-border-soft p-sm text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <span className="font-medium text-text-primary">{declaration.auditorName}</span>
            <div className="flex items-center gap-sm">
              {declaration.hasConflict ? (
                <Badge tone="major-nc">Conflict declared</Badge>
              ) : (
                <Badge tone="conforming">No conflict</Badge>
              )}
              {declaration.reviewOutcome === undefined ? (
                <Badge tone="neutral">Awaiting review</Badge>
              ) : (
                <Badge tone={declaration.reviewOutcome === 'accepted' ? 'conforming' : 'major-nc'}>
                  {declaration.reviewOutcome} by {declaration.reviewedByName}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-text-secondary">{declaration.competenceStatement}</p>
          {declaration.hasConflict ? (
            <p className="text-text-secondary">
              <span className="font-medium">Conflict:</span> {declaration.conflictDetails}
              {declaration.mitigation !== '' ? ` — Mitigation: ${declaration.mitigation}` : ''}
            </p>
          ) : null}
          {/*
            Review is offered to everyone EXCEPT the declarant. The database
            enforces this too; hiding the buttons just avoids a confusing error.
          */}
          {declaration.reviewOutcome === undefined && declaration.auditorId !== myId ? (
            <div className="flex gap-sm pt-1">
              <Button size="sm" onClick={() => decide(declaration, 'accepted')}>
                Accept
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide(declaration, 'rejected')}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ))}

      {myId !== '' && mine === undefined ? (
        <div className="flex flex-col gap-sm rounded-md border border-dashed border-border-soft p-sm">
          <span className="text-xs font-medium text-text-primary">Your declaration for this audit</span>
          <Textarea
            label="Competence for this engagement"
            rows={2}
            placeholder="Lead auditor ISO 45001 (IRCA 1234), 6 years in metal fabrication, 14 prior audits of this scope."
            value={competence}
            onChange={(event) => setCompetence(event.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={hasConflict}
              onChange={(event) => setHasConflict(event.target.checked)}
            />
            I have had a relationship with this auditee in the last two years (consultancy,
            employment, financial interest, family).
          </label>
          {hasConflict ? (
            <>
              <Textarea
                label="Describe it"
                rows={2}
                value={conflict}
                onChange={(event) => setConflict(event.target.value)}
              />
              <Textarea
                label="Mitigation, or why it is acceptable"
                rows={2}
                value={mitigation}
                onChange={(event) => setMitigation(event.target.value)}
              />
            </>
          ) : null}
          <div className="flex justify-end">
            <Button size="sm" loading={declare.isPending} onClick={submit}>
              Declare
            </Button>
          </div>
        </div>
      ) : null}

      {error !== null ? <ErrorState message={error} /> : null}
    </div>
  );
}
