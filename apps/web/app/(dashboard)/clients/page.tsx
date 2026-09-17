'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useClients } from '@/lib/hooks';
import { NewClientForm } from './NewClientForm';

export default function ClientsPage() {
  const { data, isLoading, isError } = useClients();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-800">Clients</h1>
        {creating ? null : (
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New client
          </Button>
        )}
      </div>

      {creating ? <NewClientForm onClose={() => setCreating(false)} /> : null}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={SoteriaStrings.errors.network} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message="No clients yet. Create one to start an audit." />
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
