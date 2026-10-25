import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (pathname.startsWith('/admin')) {
    const isLoginPage = pathname === '/admin/login';
    const isRootAdmin = pathname === '/admin' || pathname === '/admin/';
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = await verifyAdminSessionToken(token);

    // If already authenticated and trying to access /admin/login or root /admin
    if (isAuthenticated && (isLoginPage || isRootAdmin)) {
      return NextResponse.redirect(new URL('/admin/events', request.url));
    }

    // If on login page and not authenticated, allow access to login
    if (isLoginPage) {
      return NextResponse.next();
    }

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      if (!isRootAdmin) {
        loginUrl.searchParams.set('from', pathname);
      }
      return NextResponse.redirect(loginUrl);
    }

    // If authenticated on root /admin, redirect to /admin/events
    if (isRootAdmin) {
      return NextResponse.redirect(new URL('/admin/events', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
