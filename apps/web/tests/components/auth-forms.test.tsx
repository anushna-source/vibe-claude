import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signupAction = vi.fn();
const loginAction = vi.fn();

vi.mock('@/app/(auth)/actions', () => ({
  signupAction: (values: unknown) => signupAction(values) as unknown,
  loginAction: (values: unknown) => loginAction(values) as unknown,
}));

const { SignupForm } = await import('@/app/(auth)/_components/signup-form');
const { LoginForm } = await import('@/app/(auth)/_components/login-form');

const VALID = {
  fullName: 'Anush Sharma',
  email: 'anush@broadway.test',
  password: 'correct-horse-battery-staple',
};

beforeEach(() => {
  signupAction.mockReset();
  loginAction.mockReset();
});

async function fillSignup(overrides: Partial<typeof VALID> = {}) {
  const user = userEvent.setup();
  const values = { ...VALID, ...overrides };

  if (values.fullName) await user.type(screen.getByLabelText('Full name'), values.fullName);
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email);
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignupForm', () => {
  it('submits valid details to the server action', async () => {
    signupAction.mockResolvedValue(undefined);
    render(<SignupForm />);

    await fillSignup();

    await waitFor(() => {
      expect(signupAction).toHaveBeenCalledWith(expect.objectContaining({ email: VALID.email }));
    });
  });

  it('rejects a short password before calling the server', async () => {
    render(<SignupForm />);

    await fillSignup({ password: 'short' });

    expect(await screen.findByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(signupAction).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before calling the server', async () => {
    render(<SignupForm />);

    await fillSignup({ email: 'nope' });

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(signupAction).not.toHaveBeenCalled();
  });

  it('shows the error the API returned', async () => {
    signupAction.mockResolvedValue({ error: 'An account with that email already exists' });
    render(<SignupForm />);

    await fillSignup();

    expect(
      await screen.findByText('An account with that email already exists'),
    ).toBeInTheDocument();
  });

  it('uses a password field, so the value is never shown', () => {
    render(<SignupForm />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('marks an invalid field for assistive technology', async () => {
    render(<SignupForm />);

    await fillSignup({ email: 'nope' });

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

describe('LoginForm', () => {
  async function submitLogin(email: string, password: string) {
    const user = userEvent.setup();
    if (email) await user.type(screen.getByLabelText('Email'), email);
    if (password) await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('submits credentials to the server action', async () => {
    loginAction.mockResolvedValue(undefined);
    render(<LoginForm />);

    await submitLogin(VALID.email, 'any-password');

    await waitFor(() => {
      expect(loginAction).toHaveBeenCalledWith({ email: VALID.email, password: 'any-password' });
    });
  });

  it('does not impose the sign-up length rule on an existing password', async () => {
    loginAction.mockResolvedValue(undefined);
    render(<LoginForm />);

    await submitLogin(VALID.email, 'short');

    await waitFor(() => {
      expect(loginAction).toHaveBeenCalled();
    });
  });

  it('shows the generic failure the API returns', async () => {
    loginAction.mockResolvedValue({ error: 'Email or password is incorrect' });
    render(<LoginForm />);

    await submitLogin(VALID.email, 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('requires an email', async () => {
    render(<LoginForm />);

    await submitLogin('', 'some-password');

    expect(await screen.findByText(/email is required|valid email/i)).toBeInTheDocument();
    expect(loginAction).not.toHaveBeenCalled();
  });
});
