"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccessTokenForAccount } from "@/lib/oauth/tokens";
import { sendGmailMessage } from "@/lib/email/gmail";

export async function disconnectAccount(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthenticated");
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) throw new Error("missing accountId");

  await db
    .update(emailAccounts)
    .set({ status: "revoked" })
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId))
    );
  revalidatePath("/dashboard/settings");
}

export async function sendTestEmail(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) {
    redirect("/dashboard/settings?error=missing_account");
  }

  const [acct] = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId))
    );
  if (!acct) {
    redirect("/dashboard/settings?error=account_not_found");
  }

  let connectedEmail: string;
  try {
    const accessToken = await getAccessTokenForAccount(acct.id);

    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!userInfoRes.ok) {
      throw new Error(`userinfo failed: ${userInfoRes.status}`);
    }
    const info = (await userInfoRes.json()) as { email?: string };
    if (!info.email) throw new Error("no email on connected account");
    connectedEmail = info.email;

    await sendGmailMessage({
      accessToken,
      from: connectedEmail,
      to: connectedEmail,
      subject: "Bettr Cold Email — connection test ✅",
      body: [
        "This is a test email from Bettr Cold Email.",
        "",
        "If you're reading this in your inbox, the connection is working correctly.",
        "",
        "— Bettr Cold Email",
      ].join("\r\n"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    redirect(`/dashboard/settings?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/dashboard/settings?tested=${encodeURIComponent(connectedEmail)}`);
}

// Verify the connected account by fetching userinfo with the live token.
// Returns the Google email if the connection is healthy, null otherwise.
export async function verifyAccount(
  accountId: string
): Promise<string | null> {
  try {
    const token = await getAccessTokenForAccount(accountId);
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const { email } = (await res.json()) as { email?: string };
    return email ?? null;
  } catch {
    return null;
  }
}
