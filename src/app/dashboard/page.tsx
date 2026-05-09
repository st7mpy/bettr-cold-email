import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts, campaigns } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [active] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
    );

  const userCampaigns = active
    ? await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, userId))
        .orderBy(desc(campaigns.createdAt))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Outreach you&apos;ve launched.
          </p>
        </div>
        {active && (
          <Link href="/dashboard/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        )}
      </div>

      {!active && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your inbox to get started</CardTitle>
            <CardDescription>
              Bettr Cold Email sends from your own Gmail or Outlook. Connect an
              account to enable campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings">
              <Button>Go to settings</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {active && userCampaigns.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>
              Upload your first list of leads — the agent writes a personalized
              email per row, grounded in real research.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/campaigns/new">
              <Button>Create your first campaign</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {active && userCampaigns.length > 0 && (
        <div className="grid gap-3">
          {userCampaigns.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      {c.goalText && (
                        <CardDescription>{c.goalText}</CardDescription>
                      )}
                    </div>
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {c.status}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
