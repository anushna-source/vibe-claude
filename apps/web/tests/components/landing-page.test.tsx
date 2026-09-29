import type { Health } from '@inventory/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/health', () => ({ getHealth: vi.fn() }));
// lib/session is server-only, so it cannot be imported into a jsdom test.
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));

const { getHealth } = await import('@/lib/health');
const { getCurrentUser } = await import('@/lib/session');
const { default: LandingPage } = await import('@/app/page');

const health: Health = {
  status: 'ok',
  uptimeSeconds: 3_725,
  timestamp: '2026-09-25T04:00:00.000Z',
  version: '1.0.0',
  environment: 'development',
};

/** The page is an async Server Component, so await it before rendering. */
async function renderPage() {
  render(await LandingPage());
}

beforeEach(() => {
  vi.mocked(getHealth).mockReset();
  // Signed out unless a test says otherwise.
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue(null);
});

describe('landing page', () => {
  it('shows the live system status when the API answers', async () => {
    vi.mocked(getHealth).mockResolvedValue(health);

    await renderPage();

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
  });

  it('offers sign-up and sign-in to a visitor who is not signed in', async () => {
    vi.mocked(getHealth).mockResolvedValue(health);

    await renderPage();

    expect(screen.getByRole('link', { name: /Create an account/ })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /Open the dashboard/ })).not.toBeInTheDocument();
  });

  it('links a signed-in user straight to the dashboard instead', async () => {
    vi.mocked(getHealth).mockResolvedValue(health);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
      email: 'viewer@broadway.test',
      fullName: 'Anush Sharma',
      role: 'viewer',
      isActive: true,
      createdAt: '2026-09-29T04:00:00.000Z',
      lastLoginAt: null,
    });

    await renderPage();

    expect(screen.getByRole('link', { name: /Open the dashboard/ })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByText(/Signed in as Anush Sharma/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Create an account/ })).not.toBeInTheDocument();
  });

  it('still renders the rest of the page when the API is unreachable', async () => {
    vi.mocked(getHealth).mockRejectedValue(
      new ApiError('NETWORK_ERROR', 'Could not reach the server'),
    );

    await renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the API');
    expect(screen.getByRole('heading', { name: 'What you can do' })).toBeInTheDocument();
  });

  it('shows the request id when the API returns one', async () => {
    vi.mocked(getHealth).mockRejectedValue(
      new ApiError('INTERNAL_ERROR', 'Something went wrong', { requestId: 'trace-7' }),
    );

    await renderPage();

    expect(screen.getByText(/trace-7/)).toBeInTheDocument();
  });

  it('never leaks a non-ApiError to the page', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4000'));

    await renderPage();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ECONNREFUSED');
  });
});
