'use server';

import { loginSchema, signupSchema } from '@inventory/shared';
import { redirect } from 'next/navigation';
import { isApiError } from '@/lib/api-client';
import { login, logout, signup } from '@/lib/auth-api';
import { clearSession, getRefreshToken, writeSession } from '@/lib/session';

/**
 * Server Actions, so the tokens are set as httpOnly cookies on this origin and
 * never pass through browser JavaScript.
 */

export interface AuthActionResult {
  error: string;
}

export async function signupAction(values: unknown): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(values);

  if (!parsed.success) {
    // The form validates with the same schema, so this is a tampered request.
    return { error: 'Please check the details you entered' };
  }

  try {
    const { session, refreshToken } = await signup(parsed.data);
    await writeSession(session, refreshToken);
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not create your account' };
  }

  redirect('/dashboard');
}

export async function loginAction(values: unknown): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { error: 'Enter your email and password' };
  }

  try {
    const { session, refreshToken } = await login(parsed.data);
    await writeSession(session, refreshToken);
  } catch (error) {
    return { error: isApiError(error) ? error.message : 'Could not sign you in' };
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  await logout(await getRefreshToken());
  await clearSession();
  redirect('/');
}
