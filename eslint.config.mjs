// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the whole monorepo.
 *
 * Uses typescript-eslint's TYPE-CHECKED ruleset (via the project service), which
 * catches a class of real defects a syntax-only linter cannot — floating
 * promises, unsafe `any` flows, misused promises, redundant assertions. React
 * hooks rules cover the web app; prettier is last to disable stylistic overlap.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.{js,mjs,ts}',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        // The project service resolves each file's nearest tsconfig
        // automatically — no per-package parser wiring needed.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Deliberate, documented escape hatches exist sparingly; keep them honest
      // with a warning rather than a hard error.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  // Tests + e2e run outside the build tsconfigs; lint them syntactically without
  // requiring full type information (avoids "file not in project" noise).
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/e2e/**'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
);
