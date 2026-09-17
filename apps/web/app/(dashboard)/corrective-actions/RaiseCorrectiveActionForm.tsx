'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { SoteriaStrings, calculateTargetClosureDate } from '@soteria/core';
import type { Finding, RootCauseMethod } from '@soteria/core';
import {
  useAllFindings,
  useCorrectiveActions,
  useCreateCorrectiveAction,
  useTenantId,
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { nextDocumentSeq, timestampNow } from '@/lib/supabase-data';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';

const ROOT_CAUSE_METHODS: ReadonlyArray<{ value: RootCauseMethod; label: string }> = [
  { value: 'five_why', label: '5 Whys' },
  { value: '8d', label: '8D' },
  { value: 'fishbone', label: 'Fishbone / Ishikawa' },
  { value: 'free_form', label: 'Free form' },
];

const caSchema = z.object({
  findingId: z.string().min(1, SoteriaStrings.errors.validation),
  title: z.string().min(1, SoteriaStrings.errors.validation),
  rootCauseMethod: z.enum(['five_why', '8d', 'fishbone', 'free_form']),
  rootCauseAnalysis: z.string().default(''),
  immediateAction: z.string().default(''),
  correctiveAction: z.string().default(''),
  preventiveAction: z.string().default(''),
  effectivenessCheck: z.string().default(''),
  responsiblePersonName: z.string().min(1, SoteriaStrings.errors.validation),
  responsiblePersonEmail: z.string().email(SoteriaStrings.errors.validation),
  targetDate: z.string().min(1, SoteriaStrings.errors.validation),
});

type CAFormValues = z.infer<typeof caSchema>;

/**
 * Raises a corrective action against a nonconformity.
 *
 * WHY THIS EXISTS
 * Nothing in the product could create a corrective action or move one to
 * `submitted`. The consequence was not a missing screen but a broken loop:
 * `record_effectiveness_review` only accepts a CA already in
 * submitted/accepted/rejected, so the review control could never succeed on
 * product-created data, the reminder and escalation jobs ran against an
 * always-empty set, and a nonconformity raised in this tool could never be
 * closed. ISO 19011 §6.7 (follow-up) and ISO 45001 §10.2 were unreachable.
 *
 * Only findings that require one are offered: OFIs and strong points are not
 * nonconformities and do not take corrective action.
 */
export function RaiseCorrectiveActionForm({ onClose }: { onClose: () => void }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const createCA = useCreateCorrectiveAction();
  const { data: findings } = useAllFindings();
  const { data: existingCAs } = useCorrectiveActions();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alreadyHasCA = new Set((existingCAs ?? []).map((ca) => ca.findingId));
  const eligible = (findings ?? []).filter(
    (finding: Finding) =>
      (finding.type === 'major_nc' || finding.type === 'minor_nc') &&
      finding.status !== 'closed' &&
      !alreadyHasCA.has(finding.id),
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CAFormValues>({
    resolver: zodResolver(caSchema),
    defaultValues: { rootCauseMethod: 'five_why' },
  });

  const selectedFindingId = watch('findingId');
  const selectedFinding = eligible.find((finding) => finding.id === selectedFindingId);

  /**
   * Prefills from the finding: the title and the deadline both belong to the
   * nonconformity, not to whoever happens to be typing the form. The deadline
   * comes from the shared `calculateTargetClosureDate` so web and mobile agree.
   */
  function onFindingChange(findingId: string) {
    const finding = eligible.find((f) => f.id === findingId);
    if (finding === undefined) return;
    setValue('title', `Corrective action for ${finding.findingNumber} — ${finding.title}`);
    // calculateTargetClosureDate returns null for types with no mandatory
    // corrective action; only NCs reach this form, so the fallback is a safety
    // net rather than an expected path.
    const derived = calculateTargetClosureDate(finding.type, new Date());
    setValue(
      'targetDate',
      finding.targetClosureDate ?? derived?.toISOString().slice(0, 10) ?? '',
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const finding = eligible.find((f) => f.id === values.findingId);
    if (finding === undefined) {
      setSubmitError('Select a nonconformity to raise this against.');
      return;
    }
    try {
      const year = new Date().getFullYear();
      // A database sequence, not a guess: corrective_actions is
      // UNIQUE (tenant_id, ca_number). Same reasoning as findings.
      const sequence = await nextDocumentSeq(tenantId, 'CA', year);
      await createCA.mutateAsync({
        id: crypto.randomUUID(),
        clientId: finding.clientId,
        auditId: finding.auditId,
        findingId: finding.id,
        caNumber: `CA-${year}-${String(sequence).padStart(4, '0')}`,
        title: values.title,
        rootCauseMethod: values.rootCauseMethod,
        rootCauseAnalysis: values.rootCauseAnalysis,
        immediateAction: values.immediateAction,
        correctiveAction: values.correctiveAction,
        preventiveAction: values.preventiveAction,
        effectivenessCheck: values.effectivenessCheck,
        responsiblePersonName: values.responsiblePersonName,
        responsiblePersonEmail: values.responsiblePersonEmail,
        targetDate: values.targetDate,
        closureEvidenceIds: [],
        // Raised, not yet submitted. The auditee fills in the plan and submits;
        // only then can the auditor record an effectiveness review.
        status: 'pending',
        history: [
          {
            timestamp: timestampNow(),
            action: 'raised',
            performedBy: user?.email ?? 'Unknown',
            notes: `Raised against ${finding.findingNumber}.`,
          },
        ],
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : SoteriaStrings.errors.network);
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Raise a corrective action</CardTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardBody>
        {eligible.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Every open nonconformity already has a corrective action. Raise a finding first.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-md">
            <Select
              label="Against nonconformity"
              error={errors.findingId?.message}
              {...register('findingId', {
                onChange: (event) => onFindingChange(event.target.value),
              })}
            >
              <option value="">Select a nonconformity…</option>
              {eligible.map((finding) => (
                <option key={finding.id} value={finding.id}>
                  {finding.findingNumber} · Clause {finding.clauseNumber} · {finding.title}
                </option>
              ))}
            </Select>

            {selectedFinding !== undefined ? (
              <div className="rounded-md border border-border-soft bg-surface-muted p-md text-sm">
                <p className="font-medium text-text-primary">Nonconformity statement</p>
                <p className="mt-1 text-text-secondary">
                  {selectedFinding.nonconformityStatement}
                </p>
              </div>
            ) : null}

            <Input label="Title" error={errors.title?.message} {...register('title')} />

            <Select label="Root cause method" {...register('rootCauseMethod')}>
              {ROOT_CAUSE_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </Select>

            <Textarea label="Root cause analysis" rows={4} {...register('rootCauseAnalysis')} />
            <Textarea
              label="Immediate action (containment)"
              rows={2}
              {...register('immediateAction')}
            />
            <Textarea
              label="Corrective action (systemic fix)"
              rows={3}
              {...register('correctiveAction')}
            />
            <Textarea
              label="Preventive action (stop recurrence)"
              rows={2}
              {...register('preventiveAction')}
            />
            <Textarea
              label="How effectiveness will be checked"
              rows={2}
              {...register('effectivenessCheck')}
            />

            <div className="grid grid-cols-1 gap-md md:grid-cols-3">
              <Input
                label="Responsible person"
                error={errors.responsiblePersonName?.message}
                {...register('responsiblePersonName')}
              />
              <Input
                label="Their email"
                type="email"
                error={errors.responsiblePersonEmail?.message}
                {...register('responsiblePersonEmail')}
              />
              <Input
                label="Target closure date"
                type="date"
                error={errors.targetDate?.message}
                {...register('targetDate')}
              />
            </div>

            {submitError !== null ? <ErrorState message={submitError} /> : null}

            <div className="flex justify-end gap-sm">
              <Button type="button" variant="secondary" onClick={onClose}>
                {SoteriaStrings.common.cancel}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {SoteriaStrings.common.save}
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
