import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Runs before any module under test is imported, so lib/env.ts reads these.
process.env.API_BASE_URL = 'http://api.test/api/v1';
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.test/api/v1';
process.env.API_REQUEST_TIMEOUT_MS = '1000';

afterEach(() => {
  cleanup();
});
