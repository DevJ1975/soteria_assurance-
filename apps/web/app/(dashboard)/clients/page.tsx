'use client';

import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { useClients } from '@/lib/hooks';

export default function ClientsPage() {
  const { data, isLoading, isError } = useClients();

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold text-text-primary">Clients</h1>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message="No clients yet." />
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((client) => (
            <Card key={client.id}>
              <CardBody className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-primary">
                    {client.organizationName}
                  </span>
                  <Badge tone="primary">{client.certificationStatus.replace('_', ' ')}</Badge>
                </div>
                <p className="text-sm text-text-secondary">{client.industry}</p>
                <p className="text-xs text-text-muted">
                  {client.address.city}, {client.address.country} · {client.numberOfEmployees}{' '}
                  employees
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
