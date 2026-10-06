import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard/locations',
  useSearchParams: () => searchParams,
}));

const { SearchInput } = await import('@/components/shared/search-input');

beforeEach(() => {
  push.mockReset();
  searchParams = new URLSearchParams();
});

describe('SearchInput', () => {
  it('writes the term into the URL so the result is linkable', async () => {
    const user = userEvent.setup();
    render(<SearchInput label="Search locations" />);

    await user.type(screen.getByRole('searchbox', { name: 'Search locations' }), 'lab{Enter}');

    expect(push).toHaveBeenCalledWith('/dashboard/locations?q=lab');
  });

  it('starts a new search at the first page', async () => {
    searchParams = new URLSearchParams('page=3');
    const user = userEvent.setup();
    render(<SearchInput />);

    await user.type(screen.getByRole('searchbox'), 'store{Enter}');

    expect(push).toHaveBeenCalledWith('/dashboard/locations?q=store');
  });

  it('clears the term when the box is emptied', async () => {
    searchParams = new URLSearchParams('q=lab');
    const user = userEvent.setup();
    render(<SearchInput />);

    const box = screen.getByRole('searchbox');
    await user.clear(box);
    await user.type(box, '{Enter}');

    expect(push).toHaveBeenCalledWith('/dashboard/locations');
  });

  it('shows the current term from the URL', () => {
    searchParams = new URLSearchParams('q=classroom');
    render(<SearchInput />);

    expect(screen.getByRole('searchbox')).toHaveValue('classroom');
  });

  it('trims surrounding spaces', async () => {
    const user = userEvent.setup();
    render(<SearchInput />);

    await user.type(screen.getByRole('searchbox'), '  lab  {Enter}');

    expect(push).toHaveBeenCalledWith('/dashboard/locations?q=lab');
  });

  it('is announced as a search landmark', () => {
    render(<SearchInput />);

    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});
