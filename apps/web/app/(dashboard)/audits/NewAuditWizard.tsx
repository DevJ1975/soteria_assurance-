'use client';

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { SoteriaStrings, generateAuditNumber } from '@soteria/core';
import type { Audit, AuditType } from '@soteria/core';
import { auditsCol, setDocById } from '@soteria/firebase';
import { useTenantId, useClients } from '@/lib/hooks';
import { useAuth } from '@/lib/auth-context';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';

const AUDIT_TYPES: ReadonlyArray<{ value: AuditType; label: string }> = [
  { value: 'initial_certification', label: 'Initial certification' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'recertification', label: 'Recertification' },
  { value: 'internal', label: 'Internal' },
  { value: 'special', label: 'Special' },
];

const wizardSchema = z.object({
  clientId: z.string().min(1, SoteriaStrings.errors.validation),
  auditType: z.enum([
    'initial_certification',
    'surveillance',
    'recertification',
    'internal',
    'special',
  ]),
  scope: z.string().min(4, SoteriaStrings.errors.validation),
  managementRepresentativeName: z.string().min(2, SoteriaStrings.errors.validation),
  plannedStartDate: z.string().min(1, SoteriaStrings.errors.validation),
  plannedEndDate: z.string().min(1, SoteriaStrings.errors.validation),
});

type WizardForm = z.infer<typeof wizardSchema>;

export interface NewAuditWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** Two-step "New Audit" wizard writing a tenant-scoped audit doc (RULE 2). */
export function NewAuditWizard({ open, onClose, onCreated }: NewAuditWizardProps) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const clientsQuery = useClients();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WizardForm>({ resolver: zodResolver(wizardSchema) });

  if (!open) {
    return null;
  }

  async function goNext() {
    const ok = await trigger(['clientId', 'auditType', 'scope']);
    if (ok) {
      setStep(2);
    }
  }

  async function onSubmit(values: WizardForm) {
    setSubmitError(null);
    if (tenantId === '') {
      setSubmitError(SoteriaStrings.errors.permissionDenied);
      return;
    }
    try {
      const col = auditsCol(tenantId);
      const id = crypto.randomUUID();
      const now = Timestamp.now();
      const year = new Date().getFullYear();
      // Sequence is approximated client-side; the backend reconciles canonical
      // numbering. Uses the core generator (RULE 4 — no ad-hoc formatting).
      const auditNumber = generateAuditNumber(year, Math.floor(Math.random() * 900) + 1);

      const audit: Audit = {
        id,
        tenantId,
        clientId: values.clientId,
        auditNumber,
        auditType: values.auditType,
        auditStage: 'not_applicable',
        standard: 'ISO 45001:2018',
        scope: values.scope,
        status: 'planned',
        leadAuditorId: user?.uid ?? '',
        auditTeam: [],
        managementRepresentativeName: values.managementRepresentativeName,
        plannedStartDate: values.plannedStartDate,
        plannedEndDate: values.plannedEndDate,
        auditDays: 1,
        sitesInScope: [],
        auditPlan: {
          activities: [],
          documentReviewList: [],
          intervieweeList: [],
          areaInspectionList: [],
        },
        findings: {
          totalFindings: 0,
          majorNCs: 0,
          minorNCs: 0,
          ofis: 0,
          strongPoints: 0,
          observations: 0,
          closedNCs: 0,
          openNCs: 0,
        },
        confidentiality: 'standard',
        createdAt: now,
        updatedAt: now,
      };

      await setDocById(col, audit);
      reset();
      setStep(1);
      onCreated();
    } catch {
      setSubmitError(SoteriaStrings.errors.generic);
    }
  }

  const clients = clientsQuery.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-900/40 p-md backdrop-blur-[1px]">
      <Card className="w-full max-w-lg shadow-overlay">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{SoteriaStrings.audit.newAudit}</CardTitle>
          <button
            onClick={onClose}
            aria-label={SoteriaStrings.common.close}
            className="rounded-md p-1 text-text-secondary hover:bg-background"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md">
            {step === 1 ? (
              <>
                <Select
                  id="wizard-client"
                  label="Client"
                  error={errors.clientId?.message}
                  {...register('clientId')}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.organizationName}
                    </option>
                  ))}
                </Select>
                <Select
                  id="wizard-type"
                  label="Audit type"
                  error={errors.auditType?.message}
                  {...register('auditType')}
                >
                  {AUDIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <Textarea
                  id="wizard-scope"
                  label={SoteriaStrings.audit.scopeLabel}
                  error={errors.scope?.message}
                  {...register('scope')}
                />
                <div className="flex justify-end gap-sm">
                  <Button type="button" variant="ghost" onClick={onClose}>
                    {SoteriaStrings.common.cancel}
                  </Button>
                  <Button type="button" onClick={() => void goNext()}>
                    {SoteriaStrings.common.next}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Input
                  id="wizard-mr"
                  label="Management representative"
                  error={errors.managementRepresentativeName?.message}
                  {...register('managementRepresentativeName')}
                />
                <div className="grid grid-cols-2 gap-md">
                  <Input
                    id="wizard-start"
                    type="date"
                    label="Planned start"
                    error={errors.plannedStartDate?.message}
                    {...register('plannedStartDate')}
                  />
                  <Input
                    id="wizard-end"
                    type="date"
                    label="Planned end"
                    error={errors.plannedEndDate?.message}
                    {...register('plannedEndDate')}
                  />
                </div>
                {submitError ? <ErrorState message={submitError} /> : null}
                <div className="flex justify-between gap-sm">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    {SoteriaStrings.common.back}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {SoteriaStrings.common.save}
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
