import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only the admin area needs a session cookie up front. "/" must stay reachable without one: on a
// public site guests browse the tree, and on a private site the page itself redirects to /login
// when the API answers 401. (Real authorization always happens in the API.)
export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
