'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, Loader2, MailPlus, ShieldCheck, Users } from 'lucide-react';
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
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn';
import { SuperadminGuard } from '@/components/SuperadminGuard';
import { useAuth } from '@/lib/auth-context';
import {
  createCompany,
  inviteAuditor,
  listAdminTenants,
  listAuditorInvitations,
  type AdminTenant,
  type AuditorInvitation,
} from '@/lib/supabase-admin-data';

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

/** Pending invitations are actionable; accepted/revoked ones are history. */
function invitationVariant(status: AuditorInvitation['status']) {
  if (status === 'accepted') return 'success' as const;
  if (status === 'revoked') return 'destructive' as const;
  return 'warning' as const;
}

export default function SuperadminPage() {
  return (
    <SuperadminGuard>
      <SuperadminContent />
    </SuperadminGuard>
  );
}

function SuperadminContent() {
  const { user, signOut } = useAuth();
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [invitations, setInvitations] = useState<AuditorInvitation[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<AdminTenant['type']>('enterprise');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState<AuditorInvitation['role']>('auditor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextTenants, nextInvitations] = await Promise.all([
      listAdminTenants(),
      listAuditorInvitations(),
    ]);
    setTenants(nextTenants);
    setInvitations(nextInvitations);
    setTenantId((current) => current || nextTenants[0]?.id || '');
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Unable to load administration data.'),
    );
  }, []);

  async function submitCompany(event: FormEvent) {
    event.preventDefault();
    if (companyName.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await createCompany({ name: companyName, type: companyType });
      setCompanyName('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create company.');
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!user || tenantId === '') return;
    setBusy(true);
    setError(null);
    try {
      await inviteAuditor({ tenantId, email, displayName, role });
      setEmail('');
      setDisplayName('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create invitation.');
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = invitations.filter((item) => item.status === 'pending').length;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border-soft bg-sidebar">
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
        {error !== null ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Building2 className="size-4" aria-hidden />} label="Companies" value={tenants.length} />
          <StatCard icon={<MailPlus className="size-4" aria-hidden />} label="Invitations" value={invitations.length} />
          <StatCard icon={<Users className="size-4" aria-hidden />} label="Pending" value={pendingCount} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4 text-primary-500" aria-hidden />
                Set up a company
              </CardTitle>
              <CardDescription>Create the tenant an audit team will work under.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Acme Manufacturing Ltd"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-type">Tenant type</Label>
                  <Select
                    id="company-type"
                    value={companyType}
                    onChange={(event) => setCompanyType(event.target.value as AdminTenant['type'])}
                  >
                    {Object.entries(TENANT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Create company
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailPlus className="size-4 text-primary-500" aria-hidden />
                Invite an auditor
              </CardTitle>
              <CardDescription>
                The invitation assigns the tenant and role on first sign-in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitInvite} className="space-y-4">
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
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="auditor@example.com"
                    required
                  />
                </div>
                <Button type="submit" disabled={busy || tenantId === ''}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Create invitation
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary-500" aria-hidden />
              Companies
              <Badge variant="secondary">{tenants.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {tenants.length === 0 ? (
              <EmptyRow message="No companies yet. Create one above to get started." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TENANT_TYPE_LABELS[tenant.type]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary-500" aria-hidden />
              Invitations
              <Badge variant="secondary">{invitations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {invitations.length === 0 ? (
              <EmptyRow message="No invitations yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auditor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.displayName || '—'}</TableCell>
                      <TableCell className="text-text-secondary">{invitation.email}</TableCell>
                      <TableCell>{ROLE_LABELS[invitation.role]}</TableCell>
                      <TableCell>
                        <Badge variant={invitationVariant(invitation.status)}>
                          {invitation.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Separator />
        <p className="pb-4 text-xs text-text-muted">
          Invitations are recorded for onboarding. Email delivery still requires a server-side
          Supabase Edge Function; the tenant and role are applied by the{' '}
          <code className="font-mono">handle_invited_user</code> trigger on first sign-in.
        </p>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-faint">
            {icon}
            {label}
          </p>
          <p className="font-display text-2xl font-bold text-primary-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="px-6 pb-6 text-sm text-muted-foreground">{message}</p>;
}
