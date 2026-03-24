import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: string;
  sub: string;
  email: string;
}

// cache() deduplicates calls within a single server request
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const headersList = await headers();
  const sub = headersList.get("x-user") ?? headersList.get("x-forwarded-user");
  const email = headersList.get("x-email") ?? headersList.get("x-forwarded-email");

  if (!sub) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.sub, sub))
    .limit(1);

  if (existing.length > 0) {
    return {
      id: existing[0].id,
      sub: existing[0].sub,
      email: existing[0].email,
    };
  }

  const [newUser] = await db
    .insert(users)
    .values({
      sub,
      email: email ?? "unknown@unknown.com",
    })
    .returning();

  return {
    id: newUser.id,
    sub: newUser.sub,
    email: newUser.email,
  };
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
