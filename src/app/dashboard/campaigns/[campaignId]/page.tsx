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

export const dynamic = "force-dynamic";

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

  const [stepRow] = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.campaignId, campaign.id))
    .limit(1);

  // Status counts for the lead breakdown
  const counts = await db
    .select({
      status: leads.status,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(eq(leads.campaignId, campaign.id))
    .groupBy(leads.status);

  const totalLeads = counts.reduce((s, r) => s + r.count, 0);
  const ready = counts.find((r) => r.status === "ready")?.count ?? 0;
  const needsReview =
    counts.find((r) => r.status === "needs_review")?.count ?? 0;
  const noSignal = counts.find((r) => r.status === "no_signal")?.count ?? 0;

  // Sample of recently-generated emails (status='queued' or 'needs_review')
  const recentEmails = await db
    .select({
      id: emails.id,
      leadId: emails.leadId,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
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
  const isLaunched = campaign.status === "launched";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.goalText && (
            <p className="text-sm text-muted-foreground">{campaign.goalText}</p>
          )}
        </div>
        <span className="rounded-full border px-3 py-1 text-xs capitalize text-muted-foreground">
          {campaign.status}
        </span>
      </div>

      {sp.sampling && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          Sampling 3 leads through the agent pipeline. This usually takes
          30–60 seconds. Refresh the page to see the latest output.
        </div>
      )}
      {sp.launched && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Campaign launched. The remaining leads are running through the
          pipeline now.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total leads</CardDescription>
            <CardTitle className="text-3xl">{totalLeads}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ready to send</CardDescription>
            <CardTitle className="text-3xl text-green-700">{ready}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Need review</CardDescription>
            <CardTitle className="text-3xl text-amber-700">
              {needsReview}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>No signal</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {noSignal}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isDraft && (
        <Card>
          <CardHeader>
            <CardTitle>Review before launch</CardTitle>
            <CardDescription>
              Generate 3 sample emails before fanning out the rest. This is
              your trust check — read them, look at the agent trace, then
              launch.
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

      {isLaunched && (
        <Card>
          <CardHeader>
            <CardTitle>Sending</CardTitle>
            <CardDescription>
              Phase 4 wires up the actual SMTP/Gmail send. For now, generated
              emails sit in the database with status=&quot;queued&quot;.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {recentEmails.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Generated emails</h2>
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
                    </CardDescription>
                  </div>
                  <Link
                    href={`/dashboard/campaigns/${campaign.id}/leads/${e.leadId}`}
                  >
                    <Button variant="outline" size="sm">
                      Trace
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground">
                  {e.body}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentEmails.length === 0 && totalLeads > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No generated emails yet</CardTitle>
            <CardDescription>
              {isDraft
                ? "Click Generate 3 samples to run the agent pipeline on a few leads."
                : "Pipeline is running — refresh to see results."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {stepRow && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Campaign config</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-3">
            persona: {campaign.senderPersona}
            {"\n"}value prop: {campaign.valueProp}
            {"\n"}step 0 intent: {stepRow.intentPrompt}
          </pre>
        </details>
      )}
    </div>
  );
}
