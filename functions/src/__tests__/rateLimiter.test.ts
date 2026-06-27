import {
  AI_RATE_LIMIT_PER_HOUR,
  aiLogsPath,
  enforceRateLimit,
  getRateLimitStatus,
} from '../ai/rateLimiter';
import { __resetFirestore, getFirestore } from './mocks/admin-firestore';
import { __resetApps } from './mocks/admin-app';
import { HttpsError } from './mocks/ff-https';

// The mock Firestore is shape-compatible with the admin Firestore the source
// expects; the cast is confined to the test boundary.
const dbFor = (count: number) => {
  __resetFirestore({ count });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double boundary
  return getFirestore({ name: '[DEFAULT]' }) as any;
};

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

describe('enforceRateLimit', () => {
  it('passes through when under the cap', async () => {
    await expect(enforceRateLimit(dbFor(99), 'tenant-x')).resolves.toMatchObject({
      allowed: true,
    });
  });

  it('throws resource-exhausted at the cap', async () => {
    await expect(enforceRateLimit(dbFor(AI_RATE_LIMIT_PER_HOUR), 'tenant-x')).rejects.toThrow(
      HttpsError,
    );
    try {
      await enforceRateLimit(dbFor(AI_RATE_LIMIT_PER_HOUR + 5), 'tenant-x');
      fail('expected throw');
    } catch (err) {
      expect((err as HttpsError).code).toBe('resource-exhausted');
    }
  });
});
