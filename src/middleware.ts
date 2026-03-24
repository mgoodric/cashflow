import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const forwardedUser = request.headers.get("x-forwarded-user");

  // oauth2-proxy handles authentication externally.
  // If the header is missing, the request wasn't authenticated.
  if (!forwardedUser) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
