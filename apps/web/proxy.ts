import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(_request: NextRequest) {
  // Admin auth is handled client-side in admin/layout.tsx.
  // Server-side cookie check removed because the refreshToken cookie
  // is set on the API domain (separate Cloud Run service) and is not
  // visible to the web domain.
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
