import { handleSetTenantClaims, type SetTenantClaimsPayload } from '../auth/setTenantClaims';
import { ROLE_PERMISSIONS } from '@soteria/core';
import { type CallableRequest } from './mocks/ff-https';
import { __resetApps } from './mocks/admin-app';
import { __setSetCustomUserClaims } from './mocks/admin-auth';

const PAYLOAD: SetTenantClaimsPayload = {
  targetUid: 'target-1',
  tenantId: 'tenant-1',
  tenantType: 'cb',
  role: 'auditor',
};

function request(
  data: unknown,
  token: Record<string, unknown> | null,
): CallableRequest<unknown> {
  return token === null ? { data } : { data, auth: { uid: 'caller-1', token } };
}

let lastSet: { uid: string; claims: Record<string, unknown> } | null;

beforeEach(() => {
  __resetApps();
  lastSet = null;
  __setSetCustomUserClaims(async (uid, claims) => {
    lastSet = { uid, claims };
  });
});

describe('handleSetTenantClaims — authorization', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handleSetTenantClaims(request(PAYLOAD, null))).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('rejects non-admin roles', async () => {
    const token = { tenantId: 'tenant-1', role: 'auditor', permissions: [] };
    await expect(handleSetTenantClaims(request(PAYLOAD, token))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects a tenant_admin acting outside their tenant', async () => {
    const token = { tenantId: 'tenant-OTHER', role: 'tenant_admin', permissions: [] };
    await expect(handleSetTenantClaims(request(PAYLOAD, token))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('forbids a tenant_admin from minting super_admins', async () => {
    const token = { tenantId: 'tenant-1', role: 'tenant_admin', permissions: [] };
    const payload = { ...PAYLOAD, role: 'super_admin' as const };
    await expect(handleSetTenantClaims(request(payload, token))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});

describe('handleSetTenantClaims — success', () => {
  it('sets claims with RBAC-derived permissions (tenant_admin in own tenant)', async () => {
    const token = { tenantId: 'tenant-1', role: 'tenant_admin', permissions: [] };
    const result = await handleSetTenantClaims(request(PAYLOAD, token));

    expect(result.claims.role).toBe('auditor');
    expect(result.claims.permissions).toEqual(ROLE_PERMISSIONS.auditor);
    expect(lastSet?.uid).toBe('target-1');
    expect(lastSet?.claims).toMatchObject({ tenantId: 'tenant-1', role: 'auditor' });
  });

  it('allows a super_admin to grant any role across tenants', async () => {
    const token = { tenantId: 'tenant-root', role: 'super_admin', permissions: [] };
    const payload = { ...PAYLOAD, tenantId: 'tenant-9', role: 'tenant_admin' as const };
    const result = await handleSetTenantClaims(request(payload, token));
    expect(result.claims.permissions).toEqual(ROLE_PERMISSIONS.tenant_admin);
  });
});
