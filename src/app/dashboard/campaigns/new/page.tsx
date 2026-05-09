import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
    );
  if (!account) redirect("/dashboard/settings?error=no_account");

  const [user] = await db.select().from(users).where(eq(users.id, userId));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">New campaign</h1>
        <p className="text-sm text-muted-foreground">
          Describe who you are, what you want, and upload your list. The agent
          writes a fresh email per lead — grounded in real research, never
          mail-merged from a template.
        </p>
      </div>

      <form action={createCampaign} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1 · Name & goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Q2 partnership outreach"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goalText">
                One-liner goal{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="goalText"
                name="goalText"
                placeholder="Land 5 dev-tool partnership intros"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2 · Sender persona & value prop</CardTitle>
            <CardDescription>
              Plain-language. The agent uses this verbatim — no merge tags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senderPersona">About you</Label>
              <textarea
                id="senderPersona"
                name="senderPersona"
                rows={3}
                required
                minLength={10}
                placeholder="I'm a founder of a dev-tool startup that helps engineering teams ship faster."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valueProp">Value prop / what you're offering</Label>
              <textarea
                id="valueProp"
                name="valueProp"
                rows={3}
                required
                minLength={10}
                placeholder="A 2-week pilot of our review-time-tracking integration with Linear."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · First email — intent</CardTitle>
            <CardDescription>
              Tell the agent what this email should do. Phase 4 adds follow-ups
              and delays.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="intentPrompt">Email intent</Label>
              <textarea
                id="intentPrompt"
                name="intentPrompt"
                rows={3}
                required
                minLength={10}
                placeholder="Introduce myself, reference something specific they shipped or wrote, ask for a 15-min intro call."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4 · Upload leads (CSV)</CardTitle>
            <CardDescription>
              Paste CSV text below. Required column: <code>email</code>.
              Recommended: <code>name</code>, <code>company</code>,{" "}
              <code>title</code>, <code>notes</code>. Anything else flows into
              custom fields. Hard cap: 5,000 rows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              id="csvText"
              name="csvText"
              rows={10}
              required
              placeholder={`email,name,company,title,notes
jane@acme.com,Jane Doe,Acme,VP Eng,met at ConfX
john@beta.com,John Roe,Beta,CTO,`}
              className="font-mono text-sm flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Sending from{" "}
              <span className="font-medium">
                {user?.postalAddress ? "your connected Gmail" : "(connect first)"}
              </span>
              .
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/dashboard">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit">Create draft</Button>
        </div>
      </form>
    </div>
  );
}
