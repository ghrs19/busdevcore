import { NextRequest, NextResponse } from 'next/server';
const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL || 'busdevcore-local-session-secret-change-me';
async function valid(token?: string) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(payload))) return false;
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return data.exp > Date.now();
  } catch { return false; }
}
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/auth/') || pathname.startsWith('/_next/') || /\.(?:ico|png|jpg|jpeg|svg|css|js|woff2?)$/i.test(pathname)) return NextResponse.next();
  const allowed = pathname === '/' || pathname.startsWith('/estimates') || pathname.startsWith('/master');
  if (allowed && !await valid(request.cookies.get('busdev_session')?.value)) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
