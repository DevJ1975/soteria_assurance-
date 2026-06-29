/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        diagnostics: true,
      },
    ],
  },
  // Resolve @soteria/core from its BUILT output (functions consume the package
  // as a dependency, mirroring how it is imported at runtime).
  moduleNameMapper: {
    '^@soteria/core$': '<rootDir>/../packages/core/dist/index.js',
    '^@soteria/core/(.*)$': '<rootDir>/../packages/core/dist/$1',
    // Map external Functions SDK modules to in-repo test doubles so the suite
    // runs without a prior install of the Functions dependencies. Mirrors the
    // tsconfig.test.json `paths` so types and runtime stay in sync.
    '^firebase-functions/v2/https$': '<rootDir>/src/__tests__/mocks/ff-https.ts',
    '^firebase-functions/v2/firestore$': '<rootDir>/src/__tests__/mocks/ff-firestore.ts',
    '^firebase-functions/v2/scheduler$': '<rootDir>/src/__tests__/mocks/ff-scheduler.ts',
    '^firebase-functions/params$': '<rootDir>/src/__tests__/mocks/ff-params.ts',
    '^firebase-admin/app$': '<rootDir>/src/__tests__/mocks/admin-app.ts',
    '^firebase-admin/auth$': '<rootDir>/src/__tests__/mocks/admin-auth.ts',
    '^firebase-admin/firestore$': '<rootDir>/src/__tests__/mocks/admin-firestore.ts',
    '^firebase-admin/storage$': '<rootDir>/src/__tests__/mocks/admin-storage.ts',
    '^@anthropic-ai/sdk$': '<rootDir>/src/__tests__/mocks/anthropic.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/__tests__/**',
    '!src/common/secrets.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
};
