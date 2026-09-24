import { healthResponseSchema } from '@inventory/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, isApiError } from '@/lib/api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiRequest', () => {
  it('unwraps the data envelope', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ data: { id: 7 } })));

    await expect(apiRequest<{ id: number }>('/things')).resolves.toEqual({ id: 7 });
  });

  it('builds the URL without a double slash', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(jsonResponse({ data: null })));

    await apiRequest('/health');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/api/v1/health');
  });

  it('forwards a request id so the call can be traced in the API logs', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(jsonResponse({ data: null })));

    await apiRequest('/health', { requestId: 'trace-1' });

    const init = fetchMock.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['X-Request-Id']).toBe('trace-1');
  });

  it('sends a JSON body and content type on writes', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(jsonResponse({ data: null })));

    await apiRequest('/things', { method: 'POST', body: { name: 'Laptop' } });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"name":"Laptop"}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('validates against a schema when one is given', async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            status: 'ok',
            uptimeSeconds: 1,
            timestamp: '2026-09-24T04:00:00.000Z',
            version: '1.0.0',
            environment: 'test',
          },
        }),
      ),
    );

    await expect(apiRequest('/health', { schema: healthResponseSchema })).resolves.toMatchObject({
      status: 'ok',
      version: '1.0.0',
    });
  });

  it('rejects a payload that does not match the schema', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ data: { status: 'weird' } })));

    await expect(apiRequest('/health', { schema: healthResponseSchema })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});

describe('apiRequest failures', () => {
  it('turns the API error envelope into a typed ApiError', async () => {
    mockFetch(() =>
      Promise.resolve(
        jsonResponse(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Asset not found',
              requestId: 'trace-9',
              details: { assetTag: 'BI-LAP-0042' },
            },
          },
          404,
        ),
      ),
    );

    const error = await apiRequest('/assets/1').catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Asset not found',
      requestId: 'trace-9',
      details: { assetTag: 'BI-LAP-0042' },
    });
  });

  it('never leaks a non-envelope error body to the caller', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response('<html>nginx: upstream password=hunter2</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    const error = (await apiRequest('/health').catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(502);
    expect(JSON.stringify(error.message)).not.toContain('hunter2');
  });

  it('rejects a 200 that is not wrapped in an envelope', async () => {
    mockFetch(() => Promise.resolve(jsonResponse({ status: 'ok' })));

    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('reports an unreachable server as a network error', async () => {
    mockFetch(() => Promise.reject(new TypeError('fetch failed')));

    await expect(apiRequest('/health')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('reports a timeout when the request is aborted by the deadline', async () => {
    mockFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );

    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'TIMEOUT' });
  }, 10_000);
});
