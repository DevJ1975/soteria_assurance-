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
  // Map the @soteria/core path alias to its source so tests resolve without a
  // prior build of the dependency.
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
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
};
