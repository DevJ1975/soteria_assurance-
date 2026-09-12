'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Building2, MailPlus, ShieldCheck } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/States';
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

export default function SuperadminPage() {
  return <SuperadminGuard><SuperadminContent /></SuperadminGuard>;
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
    const [nextTenants, nextInvitations] = await Promise.all([listAdminTenants(), listAuditorInvitations()]);
    setTenants(nextTenants);
    setInvitations(nextInvitations);
    setTenantId((current) => current || nextTenants[0]?.id || '');
  }

  useEffect(() => { void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load administration data.')); }, []);

  async function submitCompany(event: FormEvent) {
    event.preventDefault();
    if (companyName.trim() === '') return;
    setBusy(true); setError(null);
    try { await createCompany({ name: companyName, type: companyType }); setCompanyName(''); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create company.'); }
    finally { setBusy(false); }
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!user || tenantId === '') return;
    setBusy(true); setError(null);
    try {
      await inviteAuditor({ tenantId, email, displayName, role, invitedBy: user.id });
      setEmail(''); setDisplayName(''); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create invitation.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background p-lg">
      <div className="mx-auto flex max-w-6xl flex-col gap-lg">
        <header className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gold-600">Administration</p>
            <h1 className="font-display text-3xl font-bold text-primary-800">Superadmin Console</h1>
            <p className="text-text-secondary">Control companies, auditor access, and tenant onboarding.</p>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
        </header>
        {error ? <ErrorState message={error} /> : null}
        <div className="grid gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle><span className="inline-flex items-center gap-sm"><Building2 className="h-5 w-5" /> Set up a company</span></CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={submitCompany} className="flex flex-col gap-md">
                <Input label="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
                <Select label="Tenant type" value={companyType} onChange={(event) => setCompanyType(event.target.value as AdminTenant['type'])}>
                  <option value="enterprise">Enterprise</option>
                  <option value="consultancy">Consultancy</option>
                  <option value="certification_body">Certification body</option>
                </Select>
                <Button type="submit" loading={busy}>Create company</Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle><span className="inline-flex items-center gap-sm"><MailPlus className="h-5 w-5" /> Invite an auditor</span></CardTitle></CardHeader>
            <CardBody>
              <form onSubmit={submitInvite} className="flex flex-col gap-md">
                <Select label="Company" value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
                  <option value="" disabled>Select a company</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </Select>
                <Input label="Auditor name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
                <Input type="email" label="Auditor email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <Select label="Role" value={role} onChange={(event) => setRole(event.target.value as AuditorInvitation['role'])}>
                  <option value="auditor">Auditor</option>
                  <option value="lead_auditor">Lead auditor</option>
                  <option value="tenant_admin">Tenant admin</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button type="submit" loading={busy} disabled={tenantId === ''}>Create invitation</Button>
              </form>
            </CardBody>
          </Card>
        </div>
        <div className="grid gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle><span className="inline-flex items-center gap-sm"><Building2 className="h-5 w-5" /> Companies ({tenants.length})</span></CardTitle></CardHeader>
            <CardBody>{tenants.length === 0 ? <LoadingState label="No companies yet" /> : <ul className="space-y-sm">{tenants.map((tenant) => <li key={tenant.id} className="flex items-center justify-between border-b border-border-soft pb-sm text-sm"><span className="font-medium">{tenant.name}</span><span className="text-text-secondary">{tenant.type}</span></li>)}</ul>}</CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle><span className="inline-flex items-center gap-sm"><ShieldCheck className="h-5 w-5" /> Invitations ({invitations.length})</span></CardTitle></CardHeader>
            <CardBody>{invitations.length === 0 ? <LoadingState label="No invitations yet" /> : <ul className="space-y-sm">{invitations.map((invitation) => <li key={invitation.id} className="border-b border-border-soft pb-sm text-sm"><div className="flex justify-between gap-sm"><span className="font-medium">{invitation.email}</span><span className="text-text-secondary">{invitation.status}</span></div><p className="text-text-secondary">{invitation.displayName} · {invitation.role}</p></li>)}</ul>}</CardBody>
          </Card>
        </div>
        <p className="text-xs text-text-muted">Invitations are recorded for onboarding. Email delivery and automatic Auth profile creation still require a server-side Supabase Edge Function.</p>
      </div>
    </main>
  );
}
