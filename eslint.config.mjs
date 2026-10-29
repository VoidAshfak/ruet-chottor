// Lint config for the API and shared packages. apps/web has its own (Next.js) config.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', 'apps/web/**', 'apps/api/src/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // CLAUDE.md §11: `any` only with a comment explaining why.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // NestJS uses empty classes for modules (`export class AppModule {}`).
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    languageOptions: { globals: { ...globals.vitest } },
  },
  prettier,
);
