import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { replies, emails, leads, campaigns } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const params = await searchParams;
  const filter = params.filter ?? "actionable";

  const userCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.userId, userId));
  const campaignIds = userCampaigns.map((c) => c.id);

  if (campaignIds.length === 0) {
    return (
      <div>
        <header className="page-head">
          <div className="section-num" style={{ color: "var(--accent)" }}>
            § 06 — Reply inbox
          </div>
          <h1
            className="display"
            style={{ fontSize: 54, lineHeight: 1, letterSpacing: "-0.035em", marginTop: 10 }}
          >
            No campaigns yet.
          </h1>
        </header>
      </div>
    );
  }

  const rows = await db
    .select({
      id: replies.id,
      classification: replies.classification,
      classificationConfidence: replies.classificationConfidence,
      summary: replies.summary,
      rawBody: replies.rawBody,
      receivedAt: replies.receivedAt,
      handledAt: replies.handledAt,
      emailId: emails.id,
      emailSubject: emails.subject,
      threadId: emails.threadId,
      leadId: leads.id,
      leadName: leads.name,
      leadEmail: leads.email,
      campaignId: campaigns.id,
      campaignName: campaigns.name,
    })
    .from(replies)
    .innerJoin(emails, eq(emails.id, replies.emailId))
    .innerJoin(leads, eq(leads.id, emails.leadId))
    .innerJoin(campaigns, eq(campaigns.id, leads.campaignId))
    .where(inArray(emails.campaignId, campaignIds))
    .orderBy(desc(replies.receivedAt))
    .limit(200);

  return <InboxClient rows={rows} initialFilter={filter} />;
}
