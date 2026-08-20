import { NextResponse, type NextRequest } from "next/server";

/**
 * Sessiya cookie'si yo'q bo'lsa darhol /login ga yuboradi.
 * Haqiqiy tekshiruv (imzo, foydalanuvchi holati) panel layout'ida bajariladi.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("botlar_session");
  const { pathname } = req.nextUrl;

  if (!hasSession && pathname !== "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // API, statik fayllar va track.js himoyalanmaydi.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|track.js).*)"],
};
