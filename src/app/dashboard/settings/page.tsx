import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  disconnectAccount,
  sendTestEmail,
  verifyAccount,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    tested?: string;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;

  const accounts = await db
    .select()
    .from(emailAccounts)
    .where(
      and(
        eq(emailAccounts.userId, userId),
        ne(emailAccounts.status, "revoked")
      )
    );

  const active = accounts[0];
  const verifiedEmail = active ? await verifyAccount(active.id) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connect the inbox you want to send from.
        </p>
      </div>

      {params.connected && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Connected{" "}
          <span className="font-medium">
            {decodeURIComponent(params.connected)}
          </span>{" "}
          successfully.
        </div>
      )}
      {params.tested && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Test email sent to{" "}
          <span className="font-medium">
            {decodeURIComponent(params.tested)}
          </span>
          . Check your inbox.
        </div>
      )}
      {params.error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Something went wrong: {decodeURIComponent(params.error)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email account</CardTitle>
          <CardDescription>
            Bettr Cold Email sends from your own Gmail. Replies thread back to
            your inbox naturally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!active ? (
            <a href="/api/oauth/google/start">
              <Button>Connect Gmail</Button>
            </a>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Provider:</span>{" "}
                <span className="font-medium">Gmail</span>
                <span className="ml-4 text-muted-foreground">Status:</span>{" "}
                <span className="font-medium capitalize">{active.status}</span>
                {verifiedEmail && (
                  <>
                    <span className="ml-4 text-muted-foreground">Mailbox:</span>{" "}
                    <span className="font-medium">{verifiedEmail}</span>
                  </>
                )}
                {!verifiedEmail && active.status === "active" && (
                  <span className="ml-4 text-amber-700">
                    Could not verify — token may need re-consent
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <form action={sendTestEmail}>
                  <input type="hidden" name="accountId" value={active.id} />
                  <Button type="submit" variant="outline">
                    Send test email
                  </Button>
                </form>
                <form action={disconnectAccount}>
                  <input type="hidden" name="accountId" value={active.id} />
                  <Button type="submit" variant="ghost">
                    Disconnect
                  </Button>
                </form>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
