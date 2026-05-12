import { redirect } from "next/navigation";
import { getCurrentUserRow } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { db } from "@/db";
import { emailAccounts, campaigns, emails, replies } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (!user.postalAddress) redirect("/onboarding");

  // Quota data from active email account
  const [account] = await db
    .select({ sentToday: emailAccounts.sentToday, dailyQuota: emailAccounts.dailyQuota })
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, user.id), eq(emailAccounts.status, "active")));

  // Actionable inbox count (positive + question replies)
  const userCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.userId, user.id));

  let inboxCount = 0;
  if (userCampaigns.length > 0) {
    const campaignIds = userCampaigns.map((c) => c.id);
    const actionable = await db
      .select({ id: replies.id })
      .from(replies)
      .innerJoin(emails, eq(emails.id, replies.emailId))
      .where(
        and(
          inArray(emails.campaignId, campaignIds),
          or(
            eq(replies.classification, "positive"),
            eq(replies.classification, "question")
          )
        )
      );
    inboxCount = actionable.length;
  }

  return (
    <div className="app-shell">
      <Sidebar
        sentToday={account?.sentToday ?? 0}
        dailyQuota={account?.dailyQuota ?? 50}
        inboxCount={inboxCount}
      />
      <main className="main-pane" style={{ overflowY: "auto", height: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
