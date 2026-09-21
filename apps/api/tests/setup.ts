// Runs before any module under test is imported, so config/env.ts reads these.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.APP_VERSION = '0.0.0-test';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3001';
// Small on purpose: keeps the oversized-body test fast.
process.env.JSON_BODY_LIMIT = '1kb';
