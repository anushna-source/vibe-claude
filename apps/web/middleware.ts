import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection and silent renewal.
 *
 * Middleware is the only place that can both read the refresh cookie and write
 * a new one during a normal page navigation, so the access token is renewed
 * here when it has expired.
 *
 * This is a convenience, not the security boundary: the API enforces auth and
 * roles on every request regardless of what happens in the browser.
 */

const ACCESS_COOKIE = 'inventory_access';
const REFRESH_COOKIE = 'inventory_refresh';

const PROTECTED = ['/dashboard'];
const SIGNED_OUT_ONLY = ['/login', '/signup'];

interface RefreshOutcome {
  accessToken: string;
  expiresIn: number;
  refreshToken: string | null;
}

async function renew(request: NextRequest, refreshToken: string): Promise<RefreshOutcome | null> {
  const base = (process.env.API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

  try {
    const response = await fetch(`${base}/auth/refresh`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        ...(request.headers.get('user-agent')
          ? { 'User-Agent': request.headers.get('user-agent') as string }
          : {}),
      },
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      data?: { accessToken?: unknown; expiresIn?: unknown };
    };

    const accessToken = body.data?.accessToken;
    const expiresIn = body.data?.expiresIn;
    if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') return null;

    let rotated: string | null = null;
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      if (name?.trim() === REFRESH_COOKIE) rotated = rest.join('=');
    }

    return { accessToken, expiresIn, refreshToken: rotated };
  } catch {
    return null;
  }
}

function redirect(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const needsSession = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const signedOutOnly = SIGNED_OUT_ONLY.includes(pathname);

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let renewed: RefreshOutcome | null = null;

  // The access cookie expires on its own; a surviving refresh cookie means the
  // session is still good and can be renewed without an interruption.
  if (!accessToken && refreshToken && (needsSession || signedOutOnly)) {
    renewed = await renew(request, refreshToken);
    if (renewed) accessToken = renewed.accessToken;
  }

  const signedIn = Boolean(accessToken);

  let response: NextResponse;
  if (needsSession && !signedIn) {
    response = redirect(request, '/login');
    // A dead refresh cookie would otherwise retry on every navigation.
    if (refreshToken) response.cookies.delete(REFRESH_COOKIE);
  } else if (signedOutOnly && signedIn) {
    response = redirect(request, '/dashboard');
  } else {
    response = NextResponse.next();
  }

  if (renewed) {
    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(ACCESS_COOKIE, renewed.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: renewed.expiresIn,
    });

    if (renewed.refreshToken) {
      response.cookies.set(REFRESH_COOKIE, renewed.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
