'use client';

import { useState } from 'react';
import { AlertCircle, Search, UserCheck, UserX } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
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
import { usePlatformUsers, useSetUserActive, useSetUserRole } from '@/lib/admin-hooks';
import type { AdminTenant, PlatformUser } from '@/lib/supabase-admin-data';

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<PlatformUser['role'], string> = {
  super_admin: 'Super admin',
  tenant_admin: 'Tenant admin',
  lead_auditor: 'Lead auditor',
  auditor: 'Auditor',
  auditee: 'Auditee',
  viewer: 'Viewer',
};

export function UsersPanel({
  tenants,
  currentUserId,
}: {
  tenants: AdminTenant[];
  currentUserId: string | undefined;
}) {
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [offset, setOffset] = useState(0);

  const users = usePlatformUsers({
    search: search || undefined,
    tenantId: tenantId || undefined,
    offset,
    limit: PAGE_SIZE,
  });
  const setActive = useSetUserActive();
  const setRole = useSetUserRole();

  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const rows = users.data?.rows ?? [];
  const error = users.error ?? setActive.error ?? setRole.error;

  /** Any filter change invalidates the current page number. */
  function refilter(apply: () => void) {
    apply();
    setOffset(0);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Every account on the platform. Deactivating one revokes its access immediately —
          <code className="mx-1 font-mono">current_tenant_id()</code> and
          <code className="mx-1 font-mono">is_super_admin()</code> both require an active profile.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-6 pb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Search name or email…"
              value={search}
              onChange={(event) => refilter(() => setSearch(event.target.value))}
              aria-label="Search users"
            />
          </div>
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
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle aria-hidden />
            <AlertDescription>
              {error instanceof Error ? error.message : 'Unexpected error.'}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardContent className="px-0 pb-0">
        {users.isPending ? (
          <div className="space-y-3 px-6 pb-6">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {search || tenantId ? 'No user matches those filters.' : 'No users yet.'}
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => {
                  // Guarding self-demotion and self-deactivation: both are
                  // recoverable only through direct database access, which is
                  // exactly the situation this console exists to avoid.
                  const isSelf = user.id === currentUserId;
                  const busy =
                    (setActive.isPending && setActive.variables?.userId === user.id) ||
                    (setRole.isPending && setRole.variables?.userId === user.id);
                  return (
                    <TableRow key={user.id} className={user.isActive ? undefined : 'opacity-60'}>
                      <TableCell>
                        <div className="font-medium">{user.displayName || '—'}</div>
                        <div className="text-text-secondary">{user.email}</div>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {tenantNames.get(user.tenantId) ?? '—'}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                        ) : (
                          <Select
                            className="h-9 w-40"
                            value={user.role}
                            disabled={busy}
                            aria-label={`Role for ${user.email}`}
                            onChange={(event) =>
                              setRole.mutate({
                                userId: user.id,
                                role: event.target.value as PlatformUser['role'],
                              })
                            }
                          >
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'success' : 'secondary'}>
                          {user.isActive ? 'active' : 'deactivated'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isSelf ? (
                          <span className="text-xs text-text-faint">you</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setActive.mutate({ userId: user.id, isActive: !user.isActive })
                            }
                          >
                            {user.isActive ? (
                              <>
                                <UserX aria-hidden />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck aria-hidden />
                                Reactivate
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              total={users.data?.total ?? 0}
              onChange={setOffset}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
