import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken');

  if (!refreshToken) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
