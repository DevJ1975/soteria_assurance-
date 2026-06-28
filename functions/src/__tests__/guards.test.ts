import {
  requireAuth,
  requireTenantMatch,
  requirePermission,
} from '../common/guards';
import { type CallableRequest } from './mocks/ff-https';

function req(token: Record<string, unknown> | null): CallableRequest<unknown> {
  return token === null ? { data: {} } : { data: {}, auth: { uid: 'u1', token } };
}

describe('requireAuth', () => {
  it('throws unauthenticated with no auth', () => {
    expect(() => requireAuth(req(null))).toThrow(/authentication/i);
  });

  it('throws permission-denied without a tenant claim', () => {
    expect(() => requireAuth(req({ role: 'auditor' }))).toThrow(/tenant/i);
  });

  it('throws permission-denied with an invalid role', () => {
    expect(() => requireAuth(req({ tenantId: 't1', role: 'wizard' }))).toThrow(/role/i);
  });

  it('returns narrowed claims for a valid token', () => {
    const auth = requireAuth(
      req({ tenantId: 't1', role: 'lead_auditor', permissions: ['ai_copilot'], tenantType: 'cb' }),
    );
    expect(auth).toMatchObject({
      uid: 'u1',
      tenantId: 't1',
      role: 'lead_auditor',
      permissions: ['ai_copilot'],
      tenantType: 'cb',
    });
  });

  it('defaults permissions to an empty array when absent', () => {
    const auth = requireAuth(req({ tenantId: 't1', role: 'viewer' }));
    expect(auth.permissions).toEqual([]);
  });
});

describe('requireTenantMatch', () => {
  it('passes when the claim matches', () => {
    const auth = requireTenantMatch(req({ tenantId: 't1', role: 'auditor' }), 't1');
    expect(auth.tenantId).toBe('t1');
  });

  it('throws on mismatch', () => {
    expect(() => requireTenantMatch(req({ tenantId: 't1', role: 'auditor' }), 't2')).toThrow(
      /tenant mismatch/i,
    );
  });
});

describe('requirePermission', () => {
  const auth = requireAuth(req({ tenantId: 't1', role: 'auditor', permissions: ['ai_copilot'] }));

  it('passes when held', () => {
    expect(() => requirePermission(auth, 'ai_copilot')).not.toThrow();
  });

  it('throws when missing', () => {
    expect(() => requirePermission(auth, 'manage_tenants')).toThrow(/permission/i);
  });
});
