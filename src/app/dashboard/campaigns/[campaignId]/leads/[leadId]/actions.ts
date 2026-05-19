"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { campaigns, emails, leads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";

/**
 * Manually re-queue an email for sending.
 * Used when an email is stuck in `queued`, `needs_review`, or `failed` and the
 * user wants to retry it without re-running the whole pipeline.
 */
export async function sendNow(emailId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify ownership via campaign → emails join
  const [row] = await db
    .select({ id: emails.id, status: emails.status, campaignId: emails.campaignId })
    .from(emails)
    .innerJoin(campaigns, eq(campaigns.id, emails.campaignId))
    .where(and(eq(emails.id, emailId), eq(campaigns.userId, userId)));
  if (!row) throw new Error("Email not found");

  // Reset status + clear stale failure info so retries don't show the old error
  await db
    .update(emails)
    .set({
      status: "queued",
      failedAt: null,
      failureReason: null,
    })
    .where(eq(emails.id, emailId));

  await inngest.send({ name: "email/send", data: { emailId } });

  revalidatePath(`/dashboard/campaigns/${row.campaignId}`);
}

/**
 * Re-run the agent pipeline for a single lead. Useful when research is stale
 * or the user wants to regenerate the draft after editing the lead's notes.
 */
export async function reprocessLead(leadId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [lead] = await db
    .select({ id: leads.id, campaignId: leads.campaignId })
    .from(leads)
    .innerJoin(campaigns, eq(campaigns.id, leads.campaignId))
    .where(and(eq(leads.id, leadId), eq(campaigns.userId, userId)));
  if (!lead) throw new Error("Lead not found");

  await db.update(leads).set({ status: "pending" }).where(eq(leads.id, leadId));
  await inngest.send({ name: "lead/process", data: { leadId } });

  revalidatePath(`/dashboard/campaigns/${lead.campaignId}/leads/${leadId}`);
}
