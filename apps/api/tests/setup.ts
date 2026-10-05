import { randomUUID } from 'node:crypto';

// Runs before any module under test is imported, so config/env.ts reads these.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.APP_VERSION = '0.0.0-test';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
// Small on purpose: keeps the oversized-body test fast.
process.env.JSON_BODY_LIMIT = '1kb';

/**
 * Every test file gets its own schema in the test database, created and dropped
 * by tests/helpers/database.ts. Pointing the app's own pool at it means requests
 * driven through supertest hit the same isolated schema, and never dev data.
 * setupFiles run once per test file, so this name is unique per file.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://inventory:inventory@localhost:5432/inventory_test';
process.env.DB_SCHEMA = `test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
