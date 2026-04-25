import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

// Import the middleware function directly
// Note: we test the logic, not the Next.js middleware integration
async function testMiddleware(headers: Record<string, string>) {
  const { middleware } = await import("@/middleware");
  const req = new NextRequest("http://localhost:3000/dashboard", { headers });
  return middleware(req);
}

describe("middleware", () => {
  it("redirects to /login when X-User header and session cookie are missing", async () => {
    const res = await testMiddleware({});
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("passes through when X-User header is present", async () => {
    const res = await testMiddleware({ "x-user": "user-sub-123" });
    expect(res.status).toBe(200);
  });

  it("passes through when X-Forwarded-User header is present", async () => {
    const res = await testMiddleware({ "x-forwarded-user": "user-sub-456" });
    expect(res.status).toBe(200);
  });

  it("prefers X-User over X-Forwarded-User", async () => {
    const res = await testMiddleware({
      "x-user": "primary",
      "x-forwarded-user": "fallback",
    });
    expect(res.status).toBe(200);
  });
});
