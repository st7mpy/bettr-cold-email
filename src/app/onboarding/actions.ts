"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureUserRow } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";

export async function saveOnboarding(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const postalAddress = String(formData.get("postalAddress") ?? "").trim();
  if (postalAddress.length < 10) {
    throw new Error("Please enter a complete postal address (min 10 chars).");
  }

  // Safety net: ensure the row exists in case the Clerk webhook hasn't fired
  // yet (common in local dev without a public tunnel).
  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  if (!existing) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (email) await ensureUserRow({ clerkId: userId, email });
  }

  await db
    .update(users)
    .set({ postalAddress })
    .where(eq(users.id, userId));

  redirect("/dashboard");
}
