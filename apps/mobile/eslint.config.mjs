// @ts-check
import rootConfig from '../../eslint.config.mjs';

/**
 * Mobile lints from its own directory (`eslint .`), so the root config's
 * `apps/mobile/**` override never matches — flat-config globs resolve against
 * the working directory, which here is apps/mobile itself. Extending the root
 * config and re-declaring the overrides locally is what actually applies them.
 */
export default [
  ...rootConfig,
  {
    // Metro resolves static assets through require(); React Native has no
    // import form that yields an asset reference.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // babel.config.js and metro.config.js are CommonJS run by Node, not part
    // of the app bundle, so they legitimately use module/require/__dirname.
    files: ['*.js', '*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
