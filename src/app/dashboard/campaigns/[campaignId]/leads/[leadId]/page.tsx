import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { campaigns, leads, emails, leadResearch } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { LeadTraceClient } from "./lead-trace-client";

export const dynamic = "force-dynamic";

interface SearchHit {
  url: string;
  title: string;
  content: string;
}
interface ResearchHook {
  type: "person_hook" | "company_hook";
  source_url: string;
  fact: string;
  quoted_phrase: string | null;
  why_relevant: string;
  recency_days: number | null;
  specificity_score: number;
}

export default async function LeadTracePage({
  params,
}: {
  params: Promise<{ campaignId: string; leadId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { campaignId, leadId } = await params;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  if (!campaign) notFound();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.campaignId, campaignId)));
  if (!lead) notFound();

  const [research] = await db
    .select()
    .from(leadResearch)
    .where(eq(leadResearch.leadId, leadId));

  const leadEmails = await db
    .select({
      id: emails.id,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
      stepIndex: emails.stepIndex,
      hookUsed: emails.hookUsed,
      createdAt: emails.createdAt,
    })
    .from(emails)
    .where(eq(emails.leadId, leadId))
    .orderBy(desc(emails.createdAt));

  const searchHits = (research?.rawSearchResults as SearchHit[] | null) ?? [];
  const hooks = (research?.hooks as ResearchHook[] | null) ?? [];

  return (
    <LeadTraceClient
      campaignId={campaignId}
      campaignName={campaign.name}
      lead={{
        id: lead.id,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        title: lead.title,
        status: lead.status,
      }}
      searchHits={searchHits}
      hooks={hooks}
      emails={leadEmails}
      hasResearch={!!research}
    />
  );
}
