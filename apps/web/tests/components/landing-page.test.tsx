import type { Health } from '@inventory/shared';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/health', () => ({ getHealth: vi.fn() }));

const { getHealth } = await import('@/lib/health');
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
});

describe('landing page', () => {
  it('shows the live system status when the API answers', async () => {
    vi.mocked(getHealth).mockResolvedValue(health);

    await renderPage();

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
  });

  it('links to the dashboard', async () => {
    vi.mocked(getHealth).mockResolvedValue(health);

    await renderPage();

    expect(screen.getByRole('link', { name: /Open the dashboard/ })).toHaveAttribute(
      'href',
      '/dashboard',
    );
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
