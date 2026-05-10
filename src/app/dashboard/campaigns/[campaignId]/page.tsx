import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { campaigns, leads, emails, sequenceSteps } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateSamples, launchCampaign } from "../new/actions";
import { computeCampaignStats } from "@/lib/campaign/stats";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  queued: "text-zinc-500",
  sent: "text-blue-600",
  bounced: "text-red-600",
  failed: "text-red-500",
  needs_review: "text-amber-600",
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ sampling?: string; launched?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { campaignId } = await params;
  const sp = await searchParams;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  if (!campaign) notFound();

  const allSteps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.campaignId, campaign.id))
    .orderBy(sequenceSteps.stepIndex);

  // Lead status breakdown
  const counts = await db
    .select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(eq(leads.campaignId, campaign.id))
    .groupBy(leads.status);

  const totalLeads = counts.reduce((s, r) => s + r.count, 0);
  const replied = counts.find((r) => r.status === "replied")?.count ?? 0;
  const needsReview = counts.find((r) => r.status === "needs_review")?.count ?? 0;
  const stopped = counts.find((r) => r.status === "stopped")?.count ?? 0;

  // Email engagement stats
  const allEmails = await db
    .select({
      status: emails.status,
      openedAt: emails.openedAt,
      clickedAt: emails.clickedAt,
      repliedAt: emails.repliedAt,
      bouncedAt: emails.bouncedAt,
    })
    .from(emails)
    .where(eq(emails.campaignId, campaign.id));

  const stats = computeCampaignStats(allEmails);

  // Recent emails with lead info
  const recentEmails = await db
    .select({
      id: emails.id,
      leadId: emails.leadId,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
      threadId: emails.threadId,
      createdAt: emails.createdAt,
      leadEmail: leads.email,
      leadName: leads.name,
    })
    .from(emails)
    .innerJoin(leads, eq(emails.leadId, leads.id))
    .where(eq(emails.campaignId, campaign.id))
    .orderBy(desc(emails.createdAt))
    .limit(10);

  const isDraft = campaign.status === "draft";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            <Link href="/dashboard" className="hover:underline">Campaigns</Link>
            {" / "}
          </p>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.goalText && (
            <p className="text-sm text-muted-foreground">{campaign.goalText}</p>
          )}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs capitalize shrink-0 ${
            campaign.status === "launched"
              ? "border-green-300 bg-green-50 text-green-900"
              : campaign.status === "paused"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-zinc-200 text-muted-foreground"
          }`}
        >
          {campaign.status}
        </span>
      </div>

      {sp.sampling && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          Sampling 3 leads through the agent pipeline — usually takes 30–60 s.
          Refresh to see results.
        </div>
      )}
      {sp.launched && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Campaign launched. All leads are queued through the pipeline.
        </div>
      )}

      {/* Lead breakdown */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total leads</CardDescription>
            <CardTitle className="text-3xl">{totalLeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Replied</CardDescription>
            <CardTitle className="text-3xl text-green-700">{replied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Need review</CardDescription>
            <CardTitle className="text-3xl text-amber-700">{needsReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stopped / unsub</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{stopped}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Engagement stats — only shown once emails are sent */}
      {stats.sent > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sent</CardDescription>
              <CardTitle className="text-3xl">{stats.sent}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open rate</CardDescription>
              <CardTitle className="text-3xl">{stats.openRate}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Click rate</CardDescription>
              <CardTitle className="text-3xl">{stats.clickRate}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reply rate</CardDescription>
              <CardTitle className="text-3xl text-green-700">{stats.replyRate}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {isDraft && (
        <Card>
          <CardHeader>
            <CardTitle>Review before launch</CardTitle>
            <CardDescription>
              Generate 3 sample emails to QA the agent output. Read them, check
              the trace, then launch when satisfied.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <form
              action={async () => {
                "use server";
                await generateSamples(campaign.id);
              }}
            >
              <Button type="submit" variant="outline">
                Generate 3 samples
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                await launchCampaign(campaign.id);
              }}
            >
              <Button type="submit">Launch all</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sequence overview */}
      {allSteps.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-sm text-foreground">
            Sequence ({allSteps.length} step{allSteps.length !== 1 ? "s" : ""})
          </summary>
          <div className="mt-3 space-y-2">
            {allSteps.map((s) => (
              <div key={s.id} className="rounded border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Step {s.stepIndex + 1}</span>
                  {s.delayDays > 0 && (
                    <span className="text-muted-foreground">
                      · send {s.delayDays}d after previous
                    </span>
                  )}
                </div>
                <p>{s.intentPrompt}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Generated email previews */}
      {recentEmails.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Emails</h2>
          {recentEmails.map((e) => (
            <Card key={e.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{e.subject}</CardTitle>
                    <CardDescription>
                      to {e.leadName ?? e.leadEmail}{" "}
                      <span className="text-muted-foreground">
                        ({e.leadEmail})
                      </span>
                      {" · "}
                      <span className={STATUS_COLORS[e.status] ?? ""}>
                        {e.status}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {e.threadId && (
                      <a
                        href={`https://mail.google.com/mail/#inbox/${e.threadId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm">
                          Gmail ↗
                        </Button>
                      </a>
                    )}
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}/leads/${e.leadId}`}
                    >
                      <Button variant="outline" size="sm">
                        Trace
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground">
                  {e.body.slice(0, 600)}
                  {e.body.length > 600 ? "…" : ""}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentEmails.length === 0 && totalLeads > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No emails yet</CardTitle>
            <CardDescription>
              {isDraft
                ? "Click Generate 3 samples to preview the agent's output."
                : "Pipeline is running — refresh in a moment."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
