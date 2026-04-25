import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get("email") as string | null;

  if (!email) {
    return new NextResponse("Email is required", { status: 400 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("cashflow-session", email, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
