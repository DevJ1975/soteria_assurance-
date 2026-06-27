'use client';

import { SoteriaStrings, ROLE_PERMISSIONS } from '@soteria/core';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth-context';

/**
 * Settings — shows the signed-in identity, tenant/role claims and the granted
 * permissions for the user's role (from core's RBAC matrix, RULE 4).
 */
export default function SettingsPage() {
  const { user, claims } = useAuth();
  const permissions = claims ? ROLE_PERMISSIONS[claims.role] : [];

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-sm text-sm">
          <Row label="Name" value={user?.displayName ?? '—'} />
          <Row label={SoteriaStrings.auth.emailLabel} value={user?.email ?? '—'} />
          <Row label="Tenant" value={claims?.tenantId ?? '—'} />
          <Row label="Role" value={claims ? claims.role.replace('_', ' ') : '—'} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-sm">
          {permissions.length === 0 ? (
            <p className="text-sm text-text-secondary">{SoteriaStrings.errors.permissionDenied}</p>
          ) : (
            permissions.map((p) => (
              <Badge key={p} tone="primary">
                {p.replace(/_/g, ' ')}
              </Badge>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-md border-b border-border pb-1">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}
