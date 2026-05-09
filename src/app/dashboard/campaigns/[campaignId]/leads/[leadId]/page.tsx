import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { campaigns, leads, emails, leadResearch } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    .select()
    .from(emails)
    .where(eq(emails.leadId, leadId))
    .orderBy(desc(emails.createdAt));

  const searchHits = (research?.rawSearchResults as SearchHit[] | null) ?? [];
  const hooks = (research?.hooks as ResearchHook[] | null) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href={`/dashboard/campaigns/${campaignId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to campaign
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {lead.name ?? lead.email}{" "}
          <span className="text-base font-normal text-muted-foreground">
            ({lead.email})
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {[lead.title, lead.company].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
            {lead.status}
          </span>
          {lead.notes && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
              notes: {lead.notes}
            </span>
          )}
        </div>
      </div>

      {!research && (
        <Card>
          <CardHeader>
            <CardTitle>No research yet</CardTitle>
            <CardDescription>
              The pipeline hasn&apos;t reached this lead. Generate samples or
              launch the campaign to kick it off.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {research && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1 · Research</CardTitle>
              <CardDescription>
                Top results from the tiered web-search plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {searchHits.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No usable search results — this lead falls into the{" "}
                  <code>no_signal</code> branch.
                </p>
              )}
              {searchHits.map((hit, i) => (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{hit.title}</div>
                  <a
                    href={hit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-700 hover:underline"
                  >
                    {hit.url}
                  </a>
                  <p className="mt-1 text-muted-foreground">{hit.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2 · Hooks</CardTitle>
              <CardDescription>
                Personalization candidates with objective specificity scores
                (0–4). Eligibility threshold: ≥ 2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {hooks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No eligible hooks. Drafter falls back to a no-claim email.
                </p>
              )}
              {hooks.map((h, i) => (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      {h.type}
                    </span>
                    <span className="text-xs">
                      score {h.specificity_score}/4
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{h.fact}</p>
                  {h.quoted_phrase && (
                    <p className="mt-1 italic text-muted-foreground">
                      &quot;{h.quoted_phrase}&quot;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {h.why_relevant}
                  </p>
                  <a
                    href={h.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-700 hover:underline"
                  >
                    {h.source_url}
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {leadEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3 · Generated email</CardTitle>
            <CardDescription>
              Drafted by Opus, critiqued by Haiku, revised by Opus on
              critique-fail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leadEmails.map((e) => (
              <div key={e.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>step {e.stepIndex}</span>
                  <span className="capitalize">status: {e.status}</span>
                </div>
                <div className="mt-2 text-sm font-medium">
                  Subject: {e.subject}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-sm font-sans">
                  {e.body}
                </pre>
                {e.hookUsed != null && (
                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Hook used</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2">
                      {JSON.stringify(e.hookUsed, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <Link href={`/dashboard/campaigns/${campaignId}`}>
          <Button variant="ghost">← Back to campaign</Button>
        </Link>
      </div>
    </div>
  );
}
