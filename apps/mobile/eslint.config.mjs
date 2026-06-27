import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the Soteria Assurance mobile app.
 *
 * Mirrors the repo-root rules; the no-console rule allows `warn`/`error` only
 * (RULE: no stray `console.log` in non-debug paths).
 */
export default tseslint.config(
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'babel.config.js', 'metro.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
);
