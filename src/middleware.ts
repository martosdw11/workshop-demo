import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware — TDD §5.2.
 *
 * TUGASNYA HANYA SATU: memeriksa KEBERADAAN cookie sesi dan me-redirect ke
 * `/login` bila tidak ada. Ia berjalan di edge runtime dan SENGAJA tidak
 * menyentuh database, supaya tidak menambah satu query ke setiap request
 * (termasuk request aset).
 *
 * Ini OPTIMASI, BUKAN PENGAMAN. Pengaman sesungguhnya adalah `requireUser()` /
 * `requireRole()` di Route Handler dan layout (§5.2).
 *
 * KEBUTUHAN EPIC FE: halaman `/login` dan `/register` belum ada (epic ini backend
 * saja). Sampai EPIC 2 story 2.3 dikerjakan, redirect di bawah akan berujung 404 —
 * itu disengaja dan tidak diperbaiki dengan membuat halaman di epic ini.
 */

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'lsai_session';

/** Halaman yang boleh diakses tanpa sesi. */
const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  // Supaya setelah login pengguna kembali ke halaman yang tadi dituju.
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

/**
 * `/api/**` SENGAJA dikecualikan: kontrak §3 mewajibkan endpoint menjawab dengan
 * amplop error JSON (`401 UNAUTHENTICATED`), bukan redirect HTML ke `/login`.
 * Otorisasi API ditegakkan `requireUser()`/`requireRole()` di tiap handler.
 */
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
