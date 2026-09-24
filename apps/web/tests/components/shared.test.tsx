import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';

describe('PageHeader', () => {
  it('renders the title as the page heading', () => {
    render(<PageHeader title="Assets" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Assets' })).toBeInTheDocument();
  });

  it('renders the description and actions when given', () => {
    render(
      <PageHeader
        title="Assets"
        description="All tracked hardware"
        actions={<Button>New</Button>}
      />,
    );

    expect(screen.getByText('All tracked hardware')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('omits the description when not given', () => {
    render(<PageHeader title="Assets" />);

    expect(screen.queryByText('All tracked hardware')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No assets yet" description="Add your first asset to begin." />);

    expect(screen.getByText('No assets yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first asset to begin.')).toBeInTheDocument();
  });

  it('renders an action when given', () => {
    render(<EmptyState title="No assets yet" action={<Button>Add asset</Button>} />);

    expect(screen.getByRole('button', { name: 'Add asset' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('is announced as an alert', () => {
    render(<ErrorState title="Could not reach the API" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the API');
  });

  it('shows the request id so a failure can be traced', () => {
    render(<ErrorState title="Failed" requestId="trace-42" />);

    expect(screen.getByText(/trace-42/)).toBeInTheDocument();
  });

  it('hides the request id line when there is none', () => {
    render(<ErrorState title="Failed" />);

    expect(screen.queryByText(/Request ID/)).not.toBeInTheDocument();
  });
});
