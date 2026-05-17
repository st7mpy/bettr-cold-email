"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { campaigns, sequenceSteps, leads, emailAccounts, emails, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { parseCsv } from "@/lib/csv/parse";
import { parseStepsFromFormData } from "@/lib/campaign/parse-steps";
import { inngest } from "@/inngest/client";

interface CreateInput {
  name: string;
  goalText: string;
  senderPersona: string;
  valueProp: string;
}

function validate(i: CreateInput) {
  if (i.name.trim().length < 2) throw new Error("Campaign name is required");
  if (i.senderPersona.trim().length < 10)
    throw new Error("Sender persona must be at least 10 chars");
  if (i.valueProp.trim().length < 10)
    throw new Error("Value prop must be at least 10 chars");
}

export async function createCampaign(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
    );
  if (!account) redirect("/dashboard/settings?error=no_account");

  await db
    .insert(users)
    .values({ id: userId, email: "(set-by-clerk-webhook)" })
    .onConflictDoNothing();

  const input: CreateInput = {
    name: String(formData.get("name") ?? ""),
    goalText: String(formData.get("goalText") ?? ""),
    senderPersona: String(formData.get("senderPersona") ?? ""),
    valueProp: String(formData.get("valueProp") ?? ""),
  };
  validate(input);

  const csvText = String(formData.get("csvText") ?? "");
  if (!csvText.trim()) throw new Error("CSV is empty");
  const parsed = parseCsv(csvText);
  if (parsed.leads.length === 0) {
    throw new Error(`CSV had no usable rows (${parsed.rejected.length} rejected)`);
  }

  const steps = parseStepsFromFormData(formData);

  const { campaignId, sampleLeadIds } = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        userId,
        name: input.name.trim(),
        goalText: input.goalText.trim() || null,
        senderPersona: input.senderPersona.trim(),
        valueProp: input.valueProp.trim(),
        status: "draft",
        emailAccountId: String(formData.get("emailAccountId") || "") || null,
      })
      .returning({ id: campaigns.id });

    await tx.insert(sequenceSteps).values(
      steps.map((s) => ({
        campaignId: campaign.id,
        stepIndex: s.stepIndex,
        intentPrompt: s.intentPrompt,
        delayDays: s.delayDays,
      }))
    );

    const insertedLeads = await tx
      .insert(leads)
      .values(
        parsed.leads.map((l) => ({
          campaignId: campaign.id,
          email: l.email,
          name: l.name,
          company: l.company,
          title: l.title,
          notes: l.notes,
          customFields: l.customFields,
          status: "pending" as const,
        }))
      )
      .returning({ id: leads.id });

    const sampleLeadIds = insertedLeads
      .map((l) => l.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    return { campaignId: campaign.id, sampleLeadIds };
  });

  // "Create & sample" button → fire 3 lead/process events right away.
  // "Save draft" button → just persist and redirect.
  const action = String(formData.get("_action") ?? "");
  if (action === "sample" && sampleLeadIds.length > 0) {
    await Promise.all(
      sampleLeadIds.map((leadId) =>
        inngest.send({ name: "lead/process", data: { leadId } })
      )
    );
    redirect(`/dashboard/campaigns/${campaignId}?sampling=1`);
  }

  redirect(`/dashboard/campaigns/${campaignId}`);
}

export async function generateSamples(campaignId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  if (!campaign) throw new Error("campaign not found");

  const pending = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.campaignId, campaignId), eq(leads.status, "pending")))
    .limit(50);

  const sample = pending
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((l) => l.id);

  await Promise.all(
    sample.map((leadId) =>
      inngest.send({ name: "lead/process", data: { leadId } })
    )
  );

  redirect(`/dashboard/campaigns/${campaignId}?sampling=1`);
}

export async function launchCampaign(campaignId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  if (!campaign) throw new Error("campaign not found");

  // Rate limit: new users can only send 2 emails total
  const FREE_EMAIL_LIMIT = 2;
  const userCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.userId, userId));
  if (userCampaigns.length > 0) {
    const campaignIds = userCampaigns.map((c) => c.id);
    const sentEmails = await db
      .select({ id: emails.id })
      .from(emails)
      .where(
        and(
          inArray(emails.campaignId, campaignIds),
          eq(emails.status, "sent")
        )
      );
    if (sentEmails.length >= FREE_EMAIL_LIMIT) {
      redirect(`/dashboard/campaigns/${campaignId}?error=limit_reached`);
    }
  }

  // Mark launched first so process-lead fans out email/send immediately
  await db
    .update(campaigns)
    .set({ status: "launched", launchedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  const pending = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.campaignId, campaignId), eq(leads.status, "pending")));

  await Promise.all(
    pending.map((l) =>
      inngest.send({ name: "lead/process", data: { leadId: l.id } })
    )
  );

  redirect(`/dashboard/campaigns/${campaignId}?launched=1`);
}
