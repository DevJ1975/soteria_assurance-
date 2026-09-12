/**
 * These tests talk to a real Supabase stack, so they run serially: they create
 * and delete tenants, and parallel workers would see each other's rows and
 * make tenant-isolation assertions meaningless.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 30_000,
  maxWorkers: 1,
};
