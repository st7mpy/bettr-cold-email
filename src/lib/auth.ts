import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function ensureUserRow(params: {
  clerkId: string;
  email: string;
}): Promise<void> {
  await db
    .insert(users)
    .values({ id: params.clerkId, email: params.email })
    .onConflictDoNothing({ target: users.id });
}

/**
 * Returns the user row for the current Clerk session, creating it if missing.
 * The "create if missing" path is a safety net for local dev where the Clerk
 * webhook may not have fired yet (no public tunnel). In production with the
 * webhook configured, the row is always pre-existing.
 */
export async function getCurrentUserRow() {
  const { userId } = await auth();
  if (!userId) return null;

  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  await ensureUserRow({ clerkId: userId, email });
  const [created] = await db.select().from(users).where(eq(users.id, userId));
  return created ?? null;
}
