import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  if (host === "admin.vtaerp.com") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (!pathname.startsWith("/admin") && !pathname.startsWith("/_next") && pathname !== "/favicon.ico") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
