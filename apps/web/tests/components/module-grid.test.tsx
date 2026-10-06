import { Boxes } from 'lucide-react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MODULES, ModuleGrid, type Module } from '@/app/_components/module-grid';

const built: Module = {
  label: 'Assets',
  description: 'Every tracked device.',
  icon: Boxes,
  href: '/assets',
  step: 6,
};

const notBuilt: Module = {
  label: 'Staff',
  description: 'The people assets are issued to.',
  icon: Boxes,
  step: 5,
};

describe('ModuleGrid', () => {
  it('links a module that is built', () => {
    render(<ModuleGrid modules={[built]} />);

    expect(screen.getByRole('link', { name: /Assets/ })).toHaveAttribute('href', '/assets');
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('never links a module that is not built yet', () => {
    render(<ModuleGrid modules={[notBuilt]} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Build step 5')).toBeInTheDocument();
  });

  it('marks an unbuilt module for screen readers', () => {
    render(<ModuleGrid modules={[notBuilt]} />);

    expect(screen.getByLabelText('Staff (not built yet)')).toBeInTheDocument();
  });

  it('renders one list item per module', () => {
    render(<ModuleGrid modules={[built, notBuilt]} />);

    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the description so the label is not the only context', () => {
    render(<ModuleGrid modules={[built]} />);

    expect(screen.getByText('Every tracked device.')).toBeInTheDocument();
  });
});

describe('MODULES', () => {
  /**
   * The real reason this component exists: no dead links on the landing page.
   * A module gets an href only once its route ships, so this list is the
   * allow-list of routes that actually exist.
   */
  const SHIPPED_ROUTES = ['/dashboard/locations'];

  it('only links to routes that exist', () => {
    const linked = MODULES.filter((entry) => entry.href !== undefined).map((entry) => entry.href);

    expect(linked.sort()).toEqual(SHIPPED_ROUTES.sort());
  });

  it('links every shipped module under /dashboard', () => {
    for (const entry of MODULES) {
      if (entry.href !== undefined) expect(entry.href.startsWith('/dashboard/')).toBe(true);
    }
  });

  it('gives every module a build step and a description', () => {
    for (const entry of MODULES) {
      expect(entry.step).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
