'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn';
import { Pagination } from './Pagination';
import { useAuditLogs } from '@/lib/admin-hooks';
import type { AdminTenant, AuditLogEntry, PlatformUser } from '@/lib/supabase-admin-data';

const PAGE_SIZE = 25;

/** The tables `log_core_table_change` is attached to. */
const LOGGED_TABLES = [
  'tenants',
  'profiles',
  'clients',
  'audits',
  'findings',
  'corrective_actions',
  'clause_assessments',
  'evidence',
] as const;

const OPERATION_VARIANT: Record<AuditLogEntry['operation'], 'success' | 'warning' | 'destructive'> =
  {
    INSERT: 'success',
    UPDATE: 'warning',
    DELETE: 'destructive',
  };

export function ActivityPanel({
  tenants,
  users,
}: {
  tenants: AdminTenant[];
  users: PlatformUser[];
}) {
  const [tenantId, setTenantId] = useState('');
  const [tableName, setTableName] = useState('');
  const [offset, setOffset] = useState(0);

  const logs = useAuditLogs({
    tenantId: tenantId || undefined,
    tableName: tableName || undefined,
    offset,
    limit: PAGE_SIZE,
  });

  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const actorNames = new Map(users.map((user) => [user.id, user.displayName || user.email]));
  const rows = logs.data?.rows ?? [];

  function refilter(apply: () => void) {
    apply();
    setOffset(0);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>
          Every insert, update and delete across the platform, captured by the append-only{' '}
          <code className="font-mono">audit_logs</code> trigger. The log cannot be edited or
          deleted through the API, including by a superadmin.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-56">
            <Select
              value={tenantId}
              onChange={(event) => refilter(() => setTenantId(event.target.value))}
              aria-label="Filter by company"
            >
              <option value="">All companies</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-56">
            <Select
              value={tableName}
              onChange={(event) => refilter(() => setTableName(event.target.value))}
              aria-label="Filter by record type"
            >
              <option value="">All record types</option>
              {LOGGED_TABLES.map((table) => (
                <option key={table} value={table}>
                  {table.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {logs.error ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle aria-hidden />
            <AlertDescription>
              {logs.error instanceof Error ? logs.error.message : 'Unexpected error.'}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardContent className="px-0 pb-0">
        {logs.isPending ? (
          <div className="space-y-3 px-6 pb-6">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {tenantId || tableName ? 'No activity matches those filters.' : 'No activity recorded yet.'}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-text-secondary">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={OPERATION_VARIANT[entry.operation]}>
                        {entry.operation.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>{entry.tableName.replace(/_/g, ' ')}</div>
                      <div className="font-mono text-xs text-text-faint">
                        {entry.recordId.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {tenantNames.get(entry.tenantId) ?? '—'}
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {/* A null actor is a database-side write: a trigger, a
                          migration, or an Edge Function using the service key. */}
                      {entry.actorId === null
                        ? 'system'
                        : (actorNames.get(entry.actorId) ?? entry.actorId.slice(0, 8))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              total={logs.data?.total ?? 0}
              onChange={setOffset}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
