import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript (lib/, help text, utilities). Page flows are tested with Playwright in e2e/.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
