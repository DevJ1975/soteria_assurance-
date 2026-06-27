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
        // ts-jest runs tests under Node, which requires CommonJS output.
        diagnostics: true,
      },
    ],
  },
  // Resolve the workspace alias so tests can import the built @soteria/core
  // source directly (mirrors the tsconfig.base.json path mapping).
  moduleNameMapper: {
    '^@soteria/core$': '<rootDir>/../core/src/index.ts',
    '^@soteria/core/(.*)$': '<rootDir>/../core/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      lines: 90,
      functions: 90,
      branches: 80,
    },
  },
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
};
