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
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/types/**',
    '!src/__tests__/**',
    // Clause datasets are hand-authored data, not logic — the dataset-integrity
    // suite validates them. The registry and helpers around them ARE covered.
    '!src/standards/*/clauses.ts',
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
