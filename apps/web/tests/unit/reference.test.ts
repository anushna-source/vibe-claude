import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getAccessToken: vi.fn() }));

const { getAccessToken } = await import('@/lib/session');
const reference = await import('@/lib/reference');

/**
 * The reference lists are the first thing the web app reads from a protected
 * endpoint, so these check the bearer token actually goes out and that the
 * envelope is validated rather than trusted.
 */

const location = {
  id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
  name: 'Lab 1',
  type: 'lab',
  building: 'Main',
  floor: '2',
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
};

function respond(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl as typeof fetch);
}

function lastCall(mock: ReturnType<typeof mockFetch>) {
  const [url, init] = mock.mock.calls[0] ?? [];
  return { url: String(url), init: init as RequestInit | undefined };
}

beforeEach(() => {
  vi.mocked(getAccessToken).mockResolvedValue('access-token-value');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listing', () => {
  it('sends the bearer token from the session cookie', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: [location], meta: { page: 1, limit: 20, total: 1 } })),
    );

    await reference.listLocations();

    const headers = lastCall(fetchMock).init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-token-value');
  });

  it('omits page=1 so the first page has a clean URL', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: [], meta: { page: 1, limit: 20, total: 0 } })),
    );

    await reference.listLocations({ page: 1 });

    expect(lastCall(fetchMock).url).toMatch(/\/locations$/);
  });

  it('passes the page, search term and type filter through', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: [], meta: { page: 2, limit: 20, total: 0 } })),
    );

    await reference.listLocations({ page: 2, q: 'lab', type: 'classroom' });

    const { url } = lastCall(fetchMock);
    expect(url).toContain('page=2');
    expect(url).toContain('q=lab');
    expect(url).toContain('type=classroom');
  });

  it('returns the rows and the meta', async () => {
    mockFetch(() =>
      Promise.resolve(respond({ data: [location], meta: { page: 1, limit: 20, total: 1 } })),
    );

    const result = await reference.listLocations();

    expect(result.data[0]?.name).toBe('Lab 1');
    expect(result.meta.total).toBe(1);
  });

  it('rejects a payload that does not match the contract', async () => {
    mockFetch(() => Promise.resolve(respond({ data: [{ nonsense: true }], meta: {} })));

    await expect(reference.listLocations()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('rejects a list wrapped in an extra data layer', async () => {
    // The bug this caught: the client expected { data: { data, meta } } while the
    // API returns { data, meta }, so every list page rendered its error state.
    mockFetch(() =>
      Promise.resolve(
        respond({ data: { data: [location], meta: { page: 1, limit: 20, total: 1 } } }),
      ),
    );

    await expect(reference.listLocations()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('surfaces the API error message', async () => {
    mockFetch(() =>
      Promise.resolve(respond({ error: { code: 'FORBIDDEN', message: 'Not allowed' } }, 403)),
    );

    await expect(reference.listDepartments()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Not allowed',
    });
  });
});

describe('writing', () => {
  it('posts a create and returns the saved record', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respond({ data: location }, 201)));

    const created = await reference.createLocation({ name: 'Lab 1', type: 'lab' });

    const { url, init } = lastCall(fetchMock);
    expect(init?.method).toBe('POST');
    expect(url).toMatch(/\/locations$/);
    expect(init?.body).toContain('Lab 1');
    expect(created.id).toBe(location.id);
  });

  it('patches an update to the record URL', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: { ...location, name: 'Lab 2' } })),
    );

    const updated = await reference.updateLocation(location.id, { name: 'Lab 2' });

    const { url, init } = lastCall(fetchMock);
    expect(init?.method).toBe('PATCH');
    expect(url).toContain(location.id);
    expect(updated.name).toBe('Lab 2');
  });

  it('handles the 204 a delete answers with', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respond(null, 204)));

    await expect(reference.deleteLocation(location.id)).resolves.toBeUndefined();
    expect(lastCall(fetchMock).init?.method).toBe('DELETE');
  });

  it('propagates a refusal to delete something still in use', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond({ error: { code: 'CONFLICT', message: 'Lab 1 still holds 12 assets.' } }, 409),
      ),
    );

    await expect(reference.deleteLocation(location.id)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Lab 1 still holds 12 assets.',
    });
  });
});

describe('the other two resources', () => {
  it('reads departments from their own path', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: [], meta: { page: 1, limit: 20, total: 0 } })),
    );

    await reference.listDepartments({ q: 'IT' });

    expect(lastCall(fetchMock).url).toContain('/departments?');
  });

  it('creates a category with its code', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(
        respond(
          {
            data: {
              id: location.id,
              name: 'Laptop',
              code: 'LAP',
              nextTagNumber: 1,
              createdAt: location.createdAt,
              updatedAt: location.updatedAt,
            },
          },
          201,
        ),
      ),
    );

    const created = await reference.createCategory({ name: 'Laptop', code: 'LAP' });

    expect(lastCall(fetchMock).url).toMatch(/\/categories$/);
    expect(created.code).toBe('LAP');
    expect(created.nextTagNumber).toBe(1);
  });

  it('deletes a department', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respond(null, 204)));

    await reference.deleteDepartment(location.id);

    expect(lastCall(fetchMock).init?.method).toBe('DELETE');
  });

  it('updates a category', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond({
          data: {
            id: location.id,
            name: 'Laptops',
            code: 'LAP',
            nextTagNumber: 4,
            createdAt: location.createdAt,
            updatedAt: location.updatedAt,
          },
        }),
      ),
    );

    const updated = await reference.updateCategory(location.id, { name: 'Laptops' });

    expect(updated.name).toBe('Laptops');
  });

  it('updates a department', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond({
          data: {
            id: location.id,
            name: 'Accounts',
            createdAt: location.createdAt,
            updatedAt: location.updatedAt,
          },
        }),
      ),
    );

    const updated = await reference.updateDepartment(location.id, { name: 'Accounts' });

    expect(updated.name).toBe('Accounts');
  });

  it('creates a department', async () => {
    mockFetch(() =>
      Promise.resolve(
        respond(
          {
            data: {
              id: location.id,
              name: 'Marketing',
              createdAt: location.createdAt,
              updatedAt: location.updatedAt,
            },
          },
          201,
        ),
      ),
    );

    const created = await reference.createDepartment({ name: 'Marketing' });

    expect(created.name).toBe('Marketing');
  });

  it('lists categories', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve(respond({ data: [], meta: { page: 1, limit: 20, total: 0 } })),
    );

    await reference.listCategories({ limit: 50 });

    expect(lastCall(fetchMock).url).toContain('limit=50');
  });

  it('deletes a category', async () => {
    const fetchMock = mockFetch(() => Promise.resolve(respond(null, 204)));

    await reference.deleteCategory(location.id);

    expect(lastCall(fetchMock).url).toContain('/categories/');
  });
});
