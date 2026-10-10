import { NextRequest, NextResponse } from 'next/server';

const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL || 'busdevcore-local-session-secret-change-me';

async function parseValidSession(token?: string): Promise<{ id: number; role: string } | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const verified = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(payload));
    if (!verified) return null;
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (data.exp <= Date.now()) return null;
    return { id: Number(data.id), role: String(data.role || '') };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets & public endpoints
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    /\.(?:ico|png|jpg|jpeg|svg|css|js|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('busdev_session')?.value;
  const session = await parseValidSession(token);

  // Unauthenticated user
  const protectedRoutes = pathname === '/' || pathname.startsWith('/estimates') || pathname.startsWith('/master') || pathname.startsWith('/profile') || pathname.startsWith('/commercial') || pathname.startsWith('/audit');
  if (protectedRoutes && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Master Data RBAC: Admin only
  if (pathname === '/master' || pathname.startsWith('/master/')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/?restricted=1', request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
