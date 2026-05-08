import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Outreach you&apos;ve launched.
        </p>
      </div>

      {!active ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>Upload your first list of leads.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Coming in Phase 3</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
