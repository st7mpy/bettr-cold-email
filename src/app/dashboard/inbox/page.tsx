import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { replies, emails, leads, campaigns } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PRIORITY: ("positive" | "question" | "negative" | "out_of_office" | "unsubscribe" | "unrelated")[] =
  ["positive", "question", "negative", "out_of_office", "unsubscribe", "unrelated"];

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
        <h1 className="mb-4 text-2xl font-semibold">Reply inbox</h1>
        <p className="text-muted-foreground">No campaigns yet.</p>
      </div>
    );
  }

  const rows = await db
    .select({
      reply: replies,
      email: emails,
      lead: leads,
      campaign: campaigns,
    })
    .from(replies)
    .innerJoin(emails, eq(emails.id, replies.emailId))
    .innerJoin(leads, eq(leads.id, emails.leadId))
    .innerJoin(campaigns, eq(campaigns.id, leads.campaignId))
    .where(inArray(emails.campaignId, campaignIds))
    .orderBy(desc(replies.receivedAt))
    .limit(200);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "actionable")
      return (
        r.reply.classification === "positive" ||
        r.reply.classification === "question"
      );
    return r.reply.classification === filter;
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Reply inbox</h1>
      <div className="mb-4 flex gap-2 text-sm">
        {["actionable", "all", ...PRIORITY].map((f) => (
          <Link
            key={f}
            href={`/dashboard/inbox?filter=${f}`}
            className={`rounded-md border px-3 py-1 ${
              filter === f ? "bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No replies in this view yet.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <article
              key={r.reply.id}
              className="rounded-lg border bg-card p-4"
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{r.lead.name ?? r.lead.email}</span>
                  <span className="text-muted-foreground"> · {r.campaign.name}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    badgeClass(r.reply.classification)
                  }`}
                >
                  {r.reply.classification ?? "unclassified"}
                  {r.reply.classificationConfidence != null &&
                    ` · ${r.reply.classificationConfidence}%`}
                </span>
              </div>
              <div className="mb-2 text-sm text-muted-foreground">
                Re: <em>{r.email.subject}</em>
              </div>
              {r.reply.summary && (
                <div className="mb-2 text-sm italic">{r.reply.summary}</div>
              )}
              <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-sm leading-relaxed">
                {r.reply.rawBody.slice(0, 1200)}
                {r.reply.rawBody.length > 1200 ? "…" : ""}
              </pre>
              <div className="mt-2 text-xs text-muted-foreground">
                <Link
                  href={`/dashboard/campaigns/${r.campaign.id}/leads/${r.lead.id}`}
                  className="underline"
                >
                  View lead trace
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function badgeClass(c: string | null): string {
  switch (c) {
    case "positive":
      return "bg-green-100 text-green-900";
    case "negative":
      return "bg-red-100 text-red-900";
    case "question":
      return "bg-amber-100 text-amber-900";
    case "out_of_office":
      return "bg-blue-100 text-blue-900";
    case "unsubscribe":
      return "bg-zinc-200 text-zinc-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

void and;
