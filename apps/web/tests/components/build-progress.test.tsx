import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BUILD_STEPS, BuildProgress, CURRENT_STEP } from '@/app/_components/build-progress';

describe('BuildProgress', () => {
  it('renders every step', () => {
    render(<BuildProgress />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(
      BUILD_STEPS.length,
    );
  });

  it('marks exactly one step as in progress', () => {
    render(<BuildProgress />);

    expect(screen.getAllByText('in progress')).toHaveLength(1);
  });

  it('labels each step state for screen readers', () => {
    render(<BuildProgress steps={['One', 'Two', 'Three']} currentStep={2} />);

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('current step')).toBeInTheDocument();
    expect(screen.getByText('not started')).toBeInTheDocument();
  });

  it('treats the first step as done once the build has moved on', () => {
    render(<BuildProgress steps={['One', 'Two']} currentStep={2} />);

    const first = within(screen.getByRole('list')).getAllByRole('listitem')[0];
    expect(first).toHaveTextContent('completed');
  });
});

describe('build order', () => {
  it('matches the eleven steps in CLAUDE.md', () => {
    expect(BUILD_STEPS).toHaveLength(11);
  });

  it('points at a step that exists', () => {
    expect(CURRENT_STEP).toBeGreaterThanOrEqual(1);
    expect(CURRENT_STEP).toBeLessThanOrEqual(BUILD_STEPS.length);
  });
});
