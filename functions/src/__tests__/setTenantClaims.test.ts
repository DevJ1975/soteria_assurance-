import { handleSetTenantClaims, type SetTenantClaimsPayload } from '../auth/setTenantClaims';
import { ROLE_PERMISSIONS } from '@soteria/core';
import { type CallableRequest } from './mocks/ff-https';
import { __resetApps } from './mocks/admin-app';
import { __resetAuth, __setGetUser, __setSetCustomUserClaims } from './mocks/admin-auth';

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
  __resetAuth();
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

  it('forbids a tenant_admin from rehoming a user who belongs to another tenant', async () => {
    __setGetUser(async (uid) => ({
      uid,
      customClaims: { tenantId: 'tenant-OTHER', role: 'auditor' },
    }));
    const token = { tenantId: 'tenant-1', role: 'tenant_admin', permissions: [] };
    await expect(handleSetTenantClaims(request(PAYLOAD, token))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(lastSet).toBeNull();
  });

  it('lets a tenant_admin re-provision an existing member of their own tenant', async () => {
    __setGetUser(async (uid) => ({
      uid,
      customClaims: { tenantId: 'tenant-1', role: 'viewer' },
    }));
    const token = { tenantId: 'tenant-1', role: 'tenant_admin', permissions: [] };
    const result = await handleSetTenantClaims(request(PAYLOAD, token));
    expect(result.targetUid).toBe('target-1');
    expect(lastSet?.uid).toBe('target-1');
  });

  it('rejects a tenant_admin targeting a non-existent user', async () => {
    __setGetUser(async () => {
      throw new Error('auth/user-not-found');
    });
    const token = { tenantId: 'tenant-1', role: 'tenant_admin', permissions: [] };
    await expect(handleSetTenantClaims(request(PAYLOAD, token))).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('does not gate super_admin callers on the target\'s current tenant', async () => {
    __setGetUser(async () => {
      throw new Error('should not be called for super_admin path');
    });
    const token = { tenantId: 'tenant-HQ', role: 'super_admin', permissions: [] };
    const result = await handleSetTenantClaims(request(PAYLOAD, token));
    expect(result.claims.tenantId).toBe('tenant-1');
  });
});

describe('handleSetTenantClaims — payload validation', () => {
  const adminToken = { tenantId: 'tenant-1', role: 'super_admin', permissions: [] };

  it.each([
    ['missing targetUid', { ...PAYLOAD, targetUid: '' }],
    ['missing tenantId', { ...PAYLOAD, tenantId: '' }],
    ['invalid tenantType', { ...PAYLOAD, tenantType: 'bogus' }],
    ['invalid role', { ...PAYLOAD, role: 'wizard' }],
  ])('rejects %s', async (_label, payload) => {
    await expect(handleSetTenantClaims(request(payload, adminToken))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects a non-object body', async () => {
    await expect(handleSetTenantClaims(request(null, adminToken))).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('carries through optional clientIds', async () => {
    const result = await handleSetTenantClaims(
      request({ ...PAYLOAD, clientIds: ['c1', 'c2'] }, adminToken),
    );
    expect(result.claims.clientIds).toEqual(['c1', 'c2']);
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
