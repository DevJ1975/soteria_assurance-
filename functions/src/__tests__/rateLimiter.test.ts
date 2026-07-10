import {
  AI_RATE_LIMIT_PER_HOUR,
  aiLogsPath,
  getRateLimitStatus,
  reserveRateLimitSlot,
} from '../ai/rateLimiter';
import { __getState, __resetFirestore, getFirestore } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { HttpsError } from './mocks/ff-https';

// The mock Firestore is shape-compatible with the admin Firestore the source
// expects; the cast is confined to the test boundary.
const dbFor = (count: number) => {
  __resetFirestore({ count });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double boundary
  return getFirestore({ name: '[DEFAULT]' }) as any;
};

const RESERVATION = { feature: 'draft_ncr', uid: 'user-1', model: 'claude-test' };

beforeEach(() => {
  __resetApps();
});

describe('aiLogsPath', () => {
  it('is tenant-scoped', () => {
    expect(aiLogsPath('tenant-x')).toBe('tenants/tenant-x/aiLogs');
  });
});

describe('getRateLimitStatus', () => {
  it('reports remaining quota under the cap', async () => {
    const status = await getRateLimitStatus(dbFor(10), 'tenant-x');
    expect(status.allowed).toBe(true);
    expect(status.used).toBe(10);
    expect(status.remaining).toBe(AI_RATE_LIMIT_PER_HOUR - 10);
  });

  it('reports not-allowed at the cap', async () => {
    const status = await getRateLimitStatus(dbFor(AI_RATE_LIMIT_PER_HOUR), 'tenant-x');
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
  });
});

describe('reserveRateLimitSlot', () => {
  it('admits under the cap and creates the pending aiLogs entry in the same transaction', async () => {
    const logId = await reserveRateLimitSlot(dbFor(99), 'tenant-x', RESERVATION);
    expect(typeof logId).toBe('string');
    expect(logId.length).toBeGreaterThan(0);

    const written = __getState().setDocs;
    expect(written).toHaveLength(1);
    expect(written[0]!.path).toContain('tenants/tenant-x/aiLogs/');
    expect(written[0]!.data).toMatchObject({
      feature: 'draft_ncr',
      uid: 'user-1',
      model: 'claude-test',
      status: 'pending',
    });
  });

  it('throws resource-exhausted at the cap and writes nothing', async () => {
    await expect(
      reserveRateLimitSlot(dbFor(AI_RATE_LIMIT_PER_HOUR), 'tenant-x', RESERVATION),
    ).rejects.toThrow(HttpsError);
    expect(__getState().setDocs).toHaveLength(0);

    try {
      await reserveRateLimitSlot(dbFor(AI_RATE_LIMIT_PER_HOUR + 5), 'tenant-x', RESERVATION);
      fail('expected throw');
    } catch (err) {
      expect((err as HttpsError).code).toBe('resource-exhausted');
    }
  });
});
