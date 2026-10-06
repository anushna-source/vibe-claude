import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';

interface Row {
  id: string;
  name: string;
  code: string;
}

const rows: Row[] = [
  { id: '1', name: 'Lab 1', code: 'L1' },
  { id: '2', name: 'Lab 2', code: 'L2' },
];

const columns: readonly Column<Row>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
  { key: 'code', header: 'Code', cell: (row) => row.code, align: 'right' },
];

describe('DataTable', () => {
  it('renders a row per record', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{ title: 'None' }}
      />,
    );

    // One header row plus two data rows.
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('Lab 1')).toBeInTheDocument();
  });

  it('renders the column headers', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{ title: 'None' }}
      />,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Name', 'Code']);
  });

  it('shows the empty state instead of a bare table when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        empty={{ title: 'No locations yet', description: 'Add the first one.' }}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No locations yet')).toBeInTheDocument();
    expect(screen.getByText('Add the first one.')).toBeInTheDocument();
  });

  it('gives the table an accessible caption', () => {
    render(
      <DataTable
        caption="Locations"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{ title: 'None' }}
      />,
    );

    expect(screen.getByRole('table', { name: 'Locations' })).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  const basePath = '/dashboard/locations';

  it('reports the visible range and total', () => {
    render(<Pagination meta={{ page: 1, limit: 20, total: 42 }} params={{}} basePath={basePath} />);

    expect(screen.getByText('Showing 1–20 of 42')).toBeInTheDocument();
  });

  it('disables Previous on the first page', () => {
    render(<Pagination meta={{ page: 1, limit: 20, total: 42 }} params={{}} basePath={basePath} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/dashboard/locations?page=2',
    );
  });

  it('disables Next on the last page', () => {
    render(<Pagination meta={{ page: 3, limit: 20, total: 42 }} params={{}} basePath={basePath} />);

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Showing 41–42 of 42')).toBeInTheDocument();
  });

  it('keeps the search term when paging', () => {
    render(
      <Pagination
        meta={{ page: 1, limit: 20, total: 42 }}
        params={{ q: 'lab' }}
        basePath={basePath}
      />,
    );

    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/dashboard/locations?q=lab&page=2',
    );
  });

  it('renders nothing when there is nothing to page', () => {
    const { container } = render(
      <Pagination meta={{ page: 1, limit: 20, total: 0 }} params={{}} basePath={basePath} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('is announced as pagination', () => {
    render(<Pagination meta={{ page: 2, limit: 10, total: 30 }} params={{}} basePath={basePath} />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/dashboard/locations',
    );
  });
});
