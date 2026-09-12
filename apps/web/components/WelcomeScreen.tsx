'use client';

import { useState } from 'react';
import { ArrowRight, ClipboardCheck, Compass, ShieldCheck } from 'lucide-react';
import { ROLE_PERMISSIONS, type Permission } from '@soteria/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

/**
 * First-run welcome, shown once per person.
 *
 * "Once" is tracked in `profiles.onboarded_at` rather than localStorage so it
 * survives a new device, a logout and a password reset — someone invited to an
 * organization should be told what they can do exactly once, not once per
 * browser.
 */

/** Plain-language description of each permission in the RBAC matrix. */
const PERMISSION_COPY: Partial<Record<Permission, string>> = {
  create_audits: 'Plan audits and schedule them against a client',
  conduct_audits: 'Work through clauses in the field and capture evidence',
  add_findings: 'Raise nonconformities, OFIs and strong points',
  close_ncs: 'Review and close nonconformities',
  manage_corrective_actions: 'Track corrective actions through to closure',
  view_audit_reports: 'Read audit reports for your organization',
  export_reports: 'Export finished reports as PDF',
  ai_copilot: 'Use the AI co-pilot to draft findings and suggest questions',
  manage_users: 'Invite colleagues and manage their access',
  billing_management: 'Manage the subscription and seats',
  manage_tenants: 'Administer every organization on the platform',
};

const ROLE_TITLES: Record<string, string> = {
  super_admin: 'Platform administrator',
  tenant_admin: 'Organization administrator',
  lead_auditor: 'Lead auditor',
  auditor: 'Auditor',
  auditee: 'Auditee',
  viewer: 'Viewer',
};

export function WelcomeScreen() {
  const { claims, user, completeOnboarding } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!claims) return null;

  // The permission matrix has, until now, only ever been displayed. Here it
  // does real work: it tells a new user what their role actually allows.
  const permissions = ROLE_PERMISSIONS[claims.role] ?? [];
  const described = permissions.filter((permission) => PERMISSION_COPY[permission]);

  async function onStart() {
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding();
    } catch {
      setError('Could not save that. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-md py-lg">
      <Card className="w-full max-w-2xl">
        <CardBody className="flex flex-col gap-lg p-lg">
          <div className="flex flex-col gap-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-800">
              <ShieldCheck className="h-6 w-6 text-gold-400" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-bold text-primary-800">
              Welcome to Soteria Assurance
            </h1>
            <p className="text-text-secondary">
              {claims.tenantName
                ? `You have been added to ${claims.tenantName} as a ${(ROLE_TITLES[claims.role] ?? claims.role).toLowerCase()}.`
                : `You are signed in as a ${(ROLE_TITLES[claims.role] ?? claims.role).toLowerCase()}.`}
            </p>
          </div>

          {described.length > 0 ? (
            <section className="flex flex-col gap-sm">
              <h2 className="flex items-center gap-sm font-display font-semibold text-text-primary">
                <ClipboardCheck className="h-4 w-4 text-primary-500" aria-hidden />
                What you can do
              </h2>
              <ul className="flex flex-col gap-1 text-sm text-text-secondary">
                {described.map((permission) => (
                  <li key={permission} className="flex gap-sm">
                    <span aria-hidden className="text-primary-400">
                      •
                    </span>
                    {PERMISSION_COPY[permission]}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-sm rounded-lg bg-primary-50 p-md">
            <h2 className="flex items-center gap-sm font-display font-semibold text-primary-800">
              <Compass className="h-4 w-4" aria-hidden />
              Where to start
            </h2>
            <p className="text-sm text-primary-700">
              The Wiki has clause-by-clause guidance for every standard your organization audits
              against — requirement text, what to look for, typical questions and the
              nonconformities that come up most often. It is the fastest way in.
            </p>
          </section>

          {error !== null ? <p className="text-sm text-major-nc">{error}</p> : null}

          <div className="flex items-center justify-between gap-md">
            <p className="text-xs text-text-muted">Signed in as {user?.email}</p>
            <Button onClick={() => void onStart()} loading={busy}>
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
