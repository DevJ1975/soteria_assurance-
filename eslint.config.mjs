// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-esm/**',
      '**/.next/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // A leading underscore is how an intentionally-discarded binding is
      // spelled — a rest-destructure that drops one key, a handler that must
      // match a signature it does not use. Without this the only way to
      // express "deliberately unused" is a disable comment on every line.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Supabase Edge Functions run on Deno, not Node: `Deno` is a global the
    // Node-oriented config does not know about, and they import by URL.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
  },
);
