'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MailPlus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/shadcn';
import { SuperadminGuard } from '@/components/SuperadminGuard';
import { ActivityPanel } from '@/components/superadmin/ActivityPanel';
import { UsersPanel } from '@/components/superadmin/UsersPanel';
import { useAuth } from '@/lib/auth-context';
import {
  invitationState,
  useAdminTenants,
  useAuditorInvitations,
  useCreateCompany,
  useInviteAuditor,
  usePlatformUsers,
  useRevokeInvitation,
  useTenantUsage,
  type InvitationState,
} from '@/lib/admin-hooks';
import type { AdminTenant, AuditorInvitation, TenantUsage } from '@/lib/supabase-admin-data';

const TENANT_TYPE_LABELS: Record<AdminTenant['type'], string> = {
  enterprise: 'Enterprise',
  consultancy: 'Consultancy',
  certification_body: 'Certification body',
};

const ROLE_LABELS: Record<AuditorInvitation['role'], string> = {
  auditor: 'Auditor',
  lead_auditor: 'Lead auditor',
  tenant_admin: 'Tenant admin',
  viewer: 'Viewer',
};

const STATE_VARIANT: Record<InvitationState, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  accepted: 'success',
  pending: 'warning',
  expired: 'secondary',
  revoked: 'destructive',
};

export default function SuperadminPage() {
  return (
    <SuperadminGuard>
      <SuperadminContent />
    </SuperadminGuard>
  );
}

function SuperadminContent() {
  const { user, signOut } = useAuth();
  const tenants = useAdminTenants();
  const invitations = useAuditorInvitations();
  const createCompany = useCreateCompany();
  const inviteAuditor = useInviteAuditor();
  const revoke = useRevokeInvitation();
  const usage = useTenantUsage();
  // One directory page, purely to resolve actor ids to names in the activity
  // log. Cached under its own key, so the Users tab's paging never disturbs it.
  const directory = usePlatformUsers({ limit: 200 });

  const tenantList = tenants.data ?? [];
  const invitationList = invitations.data ?? [];
  const pendingCount = invitationList.filter((item) => invitationState(item) === 'pending').length;
  const activeUsers = (usage.data ?? []).reduce((sum, row) => sum + row.activeMembers, 0);

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-white/10">
              <ShieldCheck className="size-5 text-gold-400" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                Administration
              </p>
              <h1 className="font-display text-xl font-bold text-white">Superadmin Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-white/70 sm:inline">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <QueryError label="companies" error={tenants.error} />
        <QueryError label="invitations" error={invitations.error} />

        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard
            icon={<Building2 className="size-4" aria-hidden />}
            label="Companies"
            value={tenantList.length}
            loading={tenants.isPending}
          />
          <StatCard
            icon={<Users className="size-4" aria-hidden />}
            label="Active users"
            value={activeUsers}
            loading={usage.isPending}
          />
          <StatCard
            icon={<MailPlus className="size-4" aria-hidden />}
            label="Invitations"
            value={invitationList.length}
            loading={invitations.isPending}
          />
          <StatCard
            icon={<Clock className="size-4" aria-hidden />}
            label="Awaiting sign-in"
            value={pendingCount}
            loading={invitations.isPending}
          />
        </div>

        <Tabs defaultValue="companies">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <CreateCompanyCard mutation={createCompany} />
            <CompaniesCard query={tenants} tenants={tenantList} usage={usage.data ?? []} />
          </TabsContent>

          <TabsContent value="invitations">
            <InviteAuditorCard mutation={inviteAuditor} tenants={tenantList} />
            <InvitationsCard
              query={invitations}
              invitations={invitationList}
              tenants={tenantList}
              revoke={revoke}
            />
            <p className="text-xs text-text-muted">
              The tenant and role on an invitation are applied by the{' '}
              <code className="font-mono">handle_invited_user</code> trigger when the invitee first
              signs in. Revoking one takes effect immediately, including for a link already sitting
              in an inbox.
            </p>
          </TabsContent>

          <TabsContent value="users">
            <UsersPanel tenants={tenantList} currentUserId={user?.id} />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityPanel tenants={tenantList} users={directory.data?.rows ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- companies */

function CreateCompanyCard({
  mutation,
}: {
  mutation: ReturnType<typeof useCreateCompany>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AdminTenant['type']>('enterprise');
  const [created, setCreated] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') return;
    mutation.mutate(
      { name: trimmed, type },
      {
        onSuccess: () => {
          setName('');
          setCreated(trimmed);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-primary-500" aria-hidden />
          Set up a company
        </CardTitle>
        <CardDescription>Create the tenant an audit team will work under.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setCreated(null);
              }}
              placeholder="Acme Manufacturing Ltd"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-type">Tenant type</Label>
            <Select
              id="company-type"
              value={type}
              onChange={(event) => setType(event.target.value as AdminTenant['type'])}
            >
              {Object.entries(TENANT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <MutationFeedback
            error={mutation.error}
            success={created === null ? null : `“${created}” created.`}
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Create company
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CompaniesCard({
  query,
  tenants,
  usage,
}: {
  query: ReturnType<typeof useAdminTenants>;
  tenants: AdminTenant[];
  usage: TenantUsage[];
}) {
  const usageByTenant = new Map(usage.map((row) => [row.tenantId, row]));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-primary-500" aria-hidden />
          Companies
          <Badge variant="secondary">{tenants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {query.isPending ? (
          <TableSkeleton columns={3} />
        ) : tenants.length === 0 ? (
          <EmptyRow message="No companies yet. Create one above to get started." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Auditor seats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TENANT_TYPE_LABELS[tenant.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">{tenant.subscriptionStatus}</TableCell>
                  <TableCell>
                    <SeatUsage usage={usageByTenant.get(tenant.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- invitations */

function InviteAuditorCard({
  mutation,
  tenants,
}: {
  mutation: ReturnType<typeof useInviteAuditor>;
  tenants: AdminTenant[];
}) {
  const [tenantId, setTenantId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AuditorInvitation['role']>('auditor');
  const [sent, setSent] = useState<string | null>(null);

  // Default to the first company once the list arrives, without clobbering a
  // choice the operator has already made.
  useEffect(() => {
    setTenantId((current) => current || tenants[0]?.id || '');
  }, [tenants]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (tenantId === '') return;
    const address = email.trim().toLowerCase();
    mutation.mutate(
      { tenantId, email: address, displayName: displayName.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          setDisplayName('');
          setSent(address);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlus className="size-4 text-primary-500" aria-hidden />
          Invite an auditor
        </CardTitle>
        <CardDescription>The invitation assigns the tenant and role on first sign-in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-company">Company</Label>
            <Select
              id="invite-company"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              required
            >
              <option value="" disabled>
                Select a company
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Auditor name</Label>
              <Input
                id="invite-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as AuditorInvitation['role'])}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Auditor email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSent(null);
              }}
              placeholder="auditor@example.com"
              required
            />
          </div>
          <MutationFeedback
            error={mutation.error}
            success={sent === null ? null : `Invitation sent to ${sent}.`}
          />
          <Button type="submit" disabled={mutation.isPending || tenants.length === 0}>
            {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Send invitation
          </Button>
          {tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a company first.</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function InvitationsCard({
  query,
  invitations,
  tenants,
  revoke,
}: {
  query: ReturnType<typeof useAuditorInvitations>;
  invitations: AuditorInvitation[];
  tenants: AdminTenant[];
  revoke: ReturnType<typeof useRevokeInvitation>;
}) {
  // Two-step confirm: revoking is reversible by re-inviting, so an inline
  // confirmation is proportionate to the risk and keeps the row in context.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary-500" aria-hidden />
          Invitations
          <Badge variant="secondary">{invitations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="px-6">
          <MutationFeedback error={revoke.error} success={null} />
        </div>
        {query.isPending ? (
          <TableSkeleton columns={5} />
        ) : invitations.length === 0 ? (
          <EmptyRow message="No invitations yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auditor</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const state = invitationState(invitation);
                const revocable = state === 'pending' || state === 'expired';
                const confirming = confirmingId === invitation.id;
                const busy = revoke.isPending && revoke.variables === invitation.id;
                return (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="font-medium">{invitation.displayName || '—'}</div>
                      <div className="text-text-secondary">{invitation.email}</div>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {tenantNames.get(invitation.tenantId) ?? '—'}
                    </TableCell>
                    <TableCell>{ROLE_LABELS[invitation.role]}</TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[state]}>{state}</Badge>
                      {state === 'pending' ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-xs text-text-faint">
                          <Clock className="size-3" aria-hidden />
                          expires {new Date(invitation.expiresAt).toLocaleDateString()}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {revocable ? (
                        confirming ? (
                          <span className="inline-flex items-center gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                revoke.mutate(invitation.id, {
                                  onSettled: () => setConfirmingId(null),
                                })
                              }
                            >
                              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                              Confirm
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(invitation.id)}
                          >
                            Revoke
                          </Button>
                        )
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- primitives */

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
          {icon}
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-12" />
        ) : (
          <p className="mt-1 font-display text-2xl font-bold text-primary-800">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Read failures are shown where the data would have been, not as form errors. */
function QueryError({ label, error }: { label: string; error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden />
      <AlertTitle>Could not load {label}</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : 'Unexpected error.'}
      </AlertDescription>
    </Alert>
  );
}

/** Per-form feedback, so one form's failure never appears above another. */
function MutationFeedback({ error, success }: { error: unknown; success: string | null }) {
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle aria-hidden />
        <AlertDescription>
          {error instanceof Error ? error.message : 'Unexpected error.'}
        </AlertDescription>
      </Alert>
    );
  }
  if (success !== null) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-conforming" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        {success}
      </p>
    );
  }
  return null;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="space-y-3 px-6 pb-6">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="px-6 pb-6 text-sm text-muted-foreground">{message}</p>;
}

/**
 * Auditor seats against the tenant's limit.
 *
 * `max_auditors` is stored but enforced nowhere — nothing blocks an invitation
 * that takes a tenant over its limit. Surfacing the number is the honest half
 * of that: an operator can at least see the overage before enforcement exists.
 */
function SeatUsage({ usage }: { usage: TenantUsage | undefined }) {
  if (!usage) return <span className="text-text-faint">—</span>;
  const over = usage.activeAuditors > usage.maxAuditors;
  return (
    <span className={over ? 'font-medium text-destructive' : 'text-text-secondary'}>
      {usage.activeAuditors} / {usage.maxAuditors}
      {over ? ' (over)' : ''}
    </span>
  );
}
