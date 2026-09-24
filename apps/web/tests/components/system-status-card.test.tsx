import type { Health } from '@inventory/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatUptime, SystemStatusCard } from '@/app/(dashboard)/_components/system-status-card';

const health: Health = {
  status: 'ok',
  uptimeSeconds: 3_725,
  timestamp: '2026-09-24T04:00:00.000Z',
  version: '1.0.0',
  environment: 'development',
};

describe('formatUptime', () => {
  it.each([
    [0, '0s'],
    [48, '48s'],
    [125, '2m 5s'],
    [3_725, '1h 2m'],
    [180_000, '2d 2h'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected);
  });

  it('never renders a negative duration', () => {
    expect(formatUptime(-5)).toBe('0s');
  });
});

describe('SystemStatusCard', () => {
  it('shows the version, environment and uptime', () => {
    render(<SystemStatusCard health={health} />);

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('1h 2m')).toBeInTheDocument();
  });

  it('badges a healthy API as ok', () => {
    render(<SystemStatusCard health={health} />);

    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('badges a degraded API', () => {
    render(<SystemStatusCard health={{ ...health, status: 'degraded' }} />);

    expect(screen.getByText('degraded')).toBeInTheDocument();
  });
});
