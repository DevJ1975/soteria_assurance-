'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useAudits } from '@/lib/hooks';

/**
 * Reports hub — lists audits whose reports can be viewed. Each links to the
 * per-audit report at /audits/report?id=… (query-param routing for static
 * export; no dynamic folder segments).
 */
export default function ReportsPage() {
  const { data, isLoading, isError } = useAudits();

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">Reports</h1>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message={SoteriaStrings.audit.noAudits} />
      ) : (
        <div className="flex flex-col gap-md">
          {(data ?? []).map((audit) => (
            <Link key={audit.id} href={`/audits/report?id=${encodeURIComponent(audit.id)}`}>
              <Card className="transition-shadow hover:shadow-lg">
                <CardBody className="flex items-center justify-between">
                  <span className="flex items-center gap-sm">
                    <FileText className="h-5 w-5 text-primary-600" aria-hidden />
                    <span className="font-mono text-sm text-primary-700">
                      {audit.auditNumber}
                    </span>
                  </span>
                  <Badge tone="primary">{audit.status.replace('_', ' ')}</Badge>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
