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
    // Each file gets its own process, so src/config/env.ts re-reads the unique
    // DB_SCHEMA that setup.ts generates.
    pool: 'forks',
    isolate: true,
    // Integration files create and drop their own schema in a shared Postgres.
    // Running them concurrently let two land on the same schema, and one dropped
    // it (or rolled its migrations back) while the other was still using it.
    // Sequential files keep every schema's lifetime to itself.
    fileParallelism: false,
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
