'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import type { CertificationStatus } from '@soteria/core';
import { useCreateClient } from '@/lib/hooks';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';

const CERTIFICATION_STATUSES: ReadonlyArray<{ value: CertificationStatus; label: string }> = [
  { value: 'not_certified', label: 'Not certified' },
  { value: 'certified', label: 'Certified' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
];

const clientSchema = z.object({
  organizationName: z.string().min(1, SoteriaStrings.errors.validation),
  industry: z.string().min(1, SoteriaStrings.errors.validation),
  street: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  country: z.string().default(''),
  postalCode: z.string().default(''),
  contactName: z.string().default(''),
  contactEmail: z.string().email(SoteriaStrings.errors.validation).or(z.literal('')),
  contactPhone: z.string().default(''),
  numberOfEmployees: z.coerce.number().int().min(0),
  numberOfSites: z.coerce.number().int().min(0),
  certificationStatus: z.enum(['not_certified', 'certified', 'expired', 'suspended']),
  certificationBody: z.string().default(''),
  certificationExpiry: z.string().default(''),
  siteNames: z.string().default(''),
});

type ClientFormValues = z.infer<typeof clientSchema>;

/**
 * Creates a client organization — the auditee.
 *
 * WHY THIS EXISTS
 * There was previously no path anywhere in the product to create one, and the
 * New Audit wizard requires a client, so no audit could be created at all on a
 * fresh tenant. ISO 19011 §6.2 (initiating an audit) begins with establishing
 * the auditee; the chain could not start.
 *
 * Sites are captured as one name per line rather than through a repeating
 * sub-form: `ClientSite` carries a full address and hazard category that a
 * lead auditor sets during planning, and pretending to collect all of that at
 * creation time would be worse than collecting the names and letting the
 * detail follow.
 */
export function NewClientForm({ onClose }: { onClose: () => void }) {
  const createClient = useCreateClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      certificationStatus: 'not_certified',
      numberOfEmployees: 0,
      numberOfSites: 0,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const siteNames = values.siteNames
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');

      const address = {
        street: values.street,
        city: values.city,
        state: values.state,
        country: values.country,
        postalCode: values.postalCode,
      };

      await createClient.mutateAsync({
        id: crypto.randomUUID(),
        organizationName: values.organizationName,
        industry: values.industry,
        address,
        contactName: values.contactName,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        numberOfEmployees: values.numberOfEmployees,
        // If sites were named, they are the source of truth for the count.
        numberOfSites: siteNames.length > 0 ? siteNames.length : values.numberOfSites,
        sites: siteNames.map((siteName, index) => ({
          siteId: `site-${index + 1}`,
          siteName,
          address,
          siteContactName: values.contactName,
          siteContactEmail: values.contactEmail,
          numberOfWorkers: 0,
          hazardCategory: 'medium' as const,
        })),
        certificationStatus: values.certificationStatus,
        certificationBody: values.certificationBody || undefined,
        certificationExpiry: values.certificationExpiry || undefined,
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : SoteriaStrings.errors.network);
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>New client organization</CardTitle>
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
        <form onSubmit={onSubmit} className="flex flex-col gap-md">
          <Input
            label="Organization name"
            error={errors.organizationName?.message}
            {...register('organizationName')}
          />
          <Input label="Industry" error={errors.industry?.message} {...register('industry')} />

          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <Input label="Street" {...register('street')} />
            <Input label="City" {...register('city')} />
            <Input label="State / region" {...register('state')} />
            <Input label="Country" {...register('country')} />
            <Input label="Postal code" {...register('postalCode')} />
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-3">
            <Input label="Contact name" {...register('contactName')} />
            <Input
              label="Contact email"
              type="email"
              error={errors.contactEmail?.message}
              {...register('contactEmail')}
            />
            <Input label="Contact phone" {...register('contactPhone')} />
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <Input
              label="Number of employees"
              type="number"
              min={0}
              error={errors.numberOfEmployees?.message}
              {...register('numberOfEmployees')}
            />
            <Input
              label="Number of sites"
              type="number"
              min={0}
              error={errors.numberOfSites?.message}
              {...register('numberOfSites')}
            />
          </div>

          <Textarea
            label="Sites (one per line)"
            rows={3}
            placeholder={'Sheffield Works\nRotherham Finishing'}
            {...register('siteNames')}
          />

          <div className="grid grid-cols-1 gap-md md:grid-cols-3">
            <Select label="Certification status" {...register('certificationStatus')}>
              {CERTIFICATION_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
            <Input label="Certification body" {...register('certificationBody')} />
            <Input label="Certification expiry" type="date" {...register('certificationExpiry')} />
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
      </CardBody>
    </Card>
  );
}
