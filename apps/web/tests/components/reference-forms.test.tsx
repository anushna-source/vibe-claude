import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCategoryAction = vi.fn();
const updateCategoryAction = vi.fn();
const deleteCategoryAction = vi.fn();
const createLocationAction = vi.fn();
const updateLocationAction = vi.fn();
const deleteLocationAction = vi.fn();
const createDepartmentAction = vi.fn();
const updateDepartmentAction = vi.fn();
const deleteDepartmentAction = vi.fn();

vi.mock('@/app/(dashboard)/dashboard/reference-actions', () => ({
  createCategoryAction: (v: unknown) => createCategoryAction(v) as unknown,
  updateCategoryAction: (id: string, v: unknown) => updateCategoryAction(id, v) as unknown,
  deleteCategoryAction: (id: string) => deleteCategoryAction(id) as unknown,
  createLocationAction: (v: unknown) => createLocationAction(v) as unknown,
  updateLocationAction: (id: string, v: unknown) => updateLocationAction(id, v) as unknown,
  deleteLocationAction: (id: string) => deleteLocationAction(id) as unknown,
  createDepartmentAction: (v: unknown) => createDepartmentAction(v) as unknown,
  updateDepartmentAction: (id: string, v: unknown) => updateDepartmentAction(id, v) as unknown,
  deleteDepartmentAction: (id: string) => deleteDepartmentAction(id) as unknown,
}));

const { CreateCategory, DeleteCategory, EditCategory } =
  await import('@/app/(dashboard)/dashboard/categories/_components/category-actions');
const { CreateLocation, EditLocation } =
  await import('@/app/(dashboard)/dashboard/locations/_components/location-actions');
const { CreateDepartment, DeleteDepartment, EditDepartment } =
  await import('@/app/(dashboard)/dashboard/departments/_components/department-actions');

beforeEach(() => {
  vi.clearAllMocks();
});

async function openDialog(name: RegExp) {
  // Radix marks everything behind the modal pointer-events: none, which the
  // default pointer check then refuses to click through.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  await user.click(screen.getByRole('button', { name }));
  await screen.findByRole('dialog');
  return user;
}

/** The confirm button inside the dialog, not the trigger behind it. */
function dialogButton(name: string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', { name });
}

describe('category form', () => {
  it('submits a valid category', async () => {
    createCategoryAction.mockResolvedValue(undefined);
    render(<CreateCategory />);

    const user = await openDialog(/Add category/);
    await user.type(screen.getByLabelText('Name'), 'Laptop');
    await user.type(screen.getByLabelText('Code'), 'LAP');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => {
      expect(createCategoryAction).toHaveBeenCalledWith({ name: 'Laptop', code: 'LAP' });
    });
  });

  it('upper-cases a lower-case code, matching the API', async () => {
    createCategoryAction.mockResolvedValue(undefined);
    render(<CreateCategory />);

    const user = await openDialog(/Add category/);
    await user.type(screen.getByLabelText('Name'), 'Laptop');
    await user.type(screen.getByLabelText('Code'), 'lap');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => {
      expect(createCategoryAction).toHaveBeenCalledWith({ name: 'Laptop', code: 'LAP' });
    });
  });

  it('rejects a code with a digit before calling the server', async () => {
    render(<CreateCategory />);

    const user = await openDialog(/Add category/);
    await user.type(screen.getByLabelText('Name'), 'Laptop');
    await user.type(screen.getByLabelText('Code'), 'L4P');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText(/2 to 6 letters/i)).toBeInTheDocument();
    expect(createCategoryAction).not.toHaveBeenCalled();
  });

  it('shows the API refusal when a code is frozen', async () => {
    createCategoryAction.mockResolvedValue({
      error: 'The code PHN is already part of 3 asset tags and cannot change.',
    });
    render(<CreateCategory />);

    const user = await openDialog(/Add category/);
    await user.type(screen.getByLabelText('Name'), 'Phone');
    await user.type(screen.getByLabelText('Code'), 'PHN');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot change');
  });
});

describe('location form', () => {
  it('defaults the type and submits it', async () => {
    createLocationAction.mockResolvedValue(undefined);
    render(<CreateLocation />);

    const user = await openDialog(/Add location/);
    await user.type(screen.getByLabelText('Name'), 'Lab 4');
    await user.click(screen.getByRole('button', { name: 'Add location' }));

    await waitFor(() => {
      expect(createLocationAction).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Lab 4', type: 'lab' }),
      );
    });
  });

  it('offers every location type', async () => {
    render(<CreateLocation />);

    await openDialog(/Add location/);
    const options = screen.getAllByRole('option').map((option) => option.textContent);

    expect(options).toEqual(['Office', 'Lab', 'Classroom', 'Server room', 'Store']);
  });

  it('rejects a name that is too short', async () => {
    render(<CreateLocation />);

    const user = await openDialog(/Add location/);
    await user.type(screen.getByLabelText('Name'), 'A');
    await user.click(screen.getByRole('button', { name: 'Add location' }));

    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(createLocationAction).not.toHaveBeenCalled();
  });
});

describe('department form', () => {
  const department = {
    id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
    name: 'Accounts',
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
  };

  it('submits a new department', async () => {
    createDepartmentAction.mockResolvedValue(undefined);
    render(<CreateDepartment />);

    const user = await openDialog(/Add department/);
    await user.type(screen.getByLabelText('Name'), 'Marketing');
    await user.click(screen.getByRole('button', { name: 'Add department' }));

    await waitFor(() => {
      expect(createDepartmentAction).toHaveBeenCalledWith({ name: 'Marketing' });
    });
  });

  it('pre-fills the edit form and sends only what changed', async () => {
    updateDepartmentAction.mockResolvedValue(undefined);
    render(<EditDepartment department={department} />);

    const user = await openDialog(/Edit/);
    const field = screen.getByLabelText('Name');
    expect(field).toHaveValue('Accounts');

    await user.clear(field);
    await user.type(field, 'Finance');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateDepartmentAction).toHaveBeenCalledWith(department.id, { name: 'Finance' });
    });
  });

  it('asks before deleting a department', async () => {
    render(<DeleteDepartment department={department} />);

    await openDialog(/Delete/);

    expect(screen.getByText('Delete Accounts?')).toBeInTheDocument();
    expect(deleteDepartmentAction).not.toHaveBeenCalled();
  });
});

describe('edit forms', () => {
  it('pre-fills a location, including its optional fields', async () => {
    updateLocationAction.mockResolvedValue(undefined);
    render(
      <EditLocation
        location={{
          id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
          name: 'Lab 1',
          type: 'lab',
          building: 'Main',
          floor: '2',
          createdAt: '2026-10-06T00:00:00.000Z',
          updatedAt: '2026-10-06T00:00:00.000Z',
        }}
      />,
    );

    const user = await openDialog(/Edit/);
    expect(screen.getByLabelText('Name')).toHaveValue('Lab 1');
    expect(screen.getByLabelText('Building')).toHaveValue('Main');
    expect(screen.getByLabelText('Type')).toHaveValue('lab');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateLocationAction).toHaveBeenCalled();
    });
  });

  it('warns that a category code only changes while unused', async () => {
    render(
      <EditCategory
        category={{
          id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
          name: 'Laptop',
          code: 'LAP',
          nextTagNumber: 3,
          createdAt: '2026-10-06T00:00:00.000Z',
          updatedAt: '2026-10-06T00:00:00.000Z',
        }}
      />,
    );

    await openDialog(/Edit/);

    expect(screen.getByText(/only change while no asset carries it/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toHaveValue('LAP');
  });
});

describe('delete confirmation', () => {
  const category = {
    id: '3f0c2e1a-9d4b-4c8e-9f2a-1b5d6e7f8a90',
    name: 'Laptop',
    code: 'LAP',
    nextTagNumber: 1,
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
  };

  it('asks before deleting', async () => {
    render(<DeleteCategory category={category} />);

    await openDialog(/Delete/);

    expect(screen.getByText('Delete Laptop?')).toBeInTheDocument();
    expect(deleteCategoryAction).not.toHaveBeenCalled();
  });

  it('deletes once confirmed', async () => {
    deleteCategoryAction.mockResolvedValue(undefined);
    render(<DeleteCategory category={category} />);

    const user = await openDialog(/Delete/);
    await user.click(dialogButton('Delete'));

    await waitFor(() => {
      expect(deleteCategoryAction).toHaveBeenCalledWith(category.id);
    });
  });

  it('keeps the dialog open and shows why when the API refuses', async () => {
    deleteCategoryAction.mockResolvedValue({ error: 'Laptop still has 12 assets.' });
    render(<DeleteCategory category={category} />);

    const user = await openDialog(/Delete/);
    await user.click(dialogButton('Delete'));

    expect(await screen.findByRole('alert')).toHaveTextContent('still has 12 assets');
    expect(screen.getByText('Delete Laptop?')).toBeInTheDocument();
  });
});
