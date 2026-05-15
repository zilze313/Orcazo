// Edge middleware: cheap, header-only auth gate to short-circuit unauthenticated
// access to creator routes. Does NOT validate sessions (DB lookup needs Node
// runtime); page handlers do that.

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = [
  '/login', '/admin/login',
  '/api/auth', '/api/admin/auth',
  '/api/inbound-email', '/api/public',
  '/auth',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // public paths and assets
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // creator routes — quick cookie presence check
  if (
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/my-campaigns') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/social-accounts') ||
    pathname.startsWith('/payouts') ||
    pathname.startsWith('/referrals') ||
    pathname.startsWith('/updates') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/guide')
  ) {
    if (!req.cookies.get('sf_session')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!req.cookies.get('sf_admin')) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)).*)'],
};
