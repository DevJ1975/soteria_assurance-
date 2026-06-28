'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useAudits } from '@/lib/hooks';
import { NewAuditWizard } from './NewAuditWizard';

export default function AuditsPage() {
  const { data, isLoading, isError, refetch } = useAudits();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">
          {SoteriaStrings.audit.listTitle}
        </h1>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          {SoteriaStrings.audit.newAudit}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message={SoteriaStrings.audit.noAudits} />
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((audit) => (
            <Link key={audit.id} href={`/audits/view?id=${encodeURIComponent(audit.id)}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardBody className="flex flex-col gap-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-primary-700">
                      {audit.auditNumber}
                    </span>
                    <Badge tone="primary">{audit.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-text-secondary">{audit.scope}</p>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>{audit.auditType.replace('_', ' ')}</span>
                    <span>{audit.plannedStartDate}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewAuditWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          void refetch();
        }}
      />
    </div>
  );
}
