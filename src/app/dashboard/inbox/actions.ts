"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { replies, emails, leads, campaigns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function markHandled(replyId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify the reply belongs to this user before updating
  const [row] = await db
    .select({ id: replies.id })
    .from(replies)
    .innerJoin(emails, eq(emails.id, replies.emailId))
    .innerJoin(leads, eq(leads.id, emails.leadId))
    .innerJoin(campaigns, eq(campaigns.id, leads.campaignId))
    .where(and(eq(replies.id, replyId), eq(campaigns.userId, userId)));

  if (!row) return;

  await db
    .update(replies)
    .set({ handledAt: new Date() })
    .where(eq(replies.id, replyId));

  revalidatePath("/dashboard/inbox");
}
