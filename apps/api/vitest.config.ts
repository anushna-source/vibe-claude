import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace package to its source so `pnpm test` does not
      // require `pnpm build` to have run first.
      '@inventory/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // Process entry points, exercised by running them rather than by tests:
      // the server bootstrap and the two database CLIs (`pnpm db:migrate`,
      // `pnpm db:seed`). The logic they call is covered.
      exclude: ['src/server.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
