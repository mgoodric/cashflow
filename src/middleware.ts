import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const forwardedUser =
    request.headers.get("x-user") ?? request.headers.get("x-forwarded-user");

  // If oauth2-proxy set the header, pass through unchanged
  if (forwardedUser) {
    return NextResponse.next();
  }

  // Fallback: check for local login session cookie
  const session = request.cookies.get("cashflow-session")?.value;
  if (session) {
    // Inject X-User and X-Email headers so auth.ts works unchanged
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user", session);
    requestHeaders.set("x-email", session);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // No auth at all — redirect to local login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
