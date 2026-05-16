import { inngest } from "../client";
import { db } from "@/db";
import {
  emailAccounts,
  emails,
  leads,
  replies,
  suppressionList,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getAccessTokenForAccount } from "@/lib/oauth/tokens";
import {
  listGmailMessages,
  getGmailMessage,
} from "@/lib/email/gmail-fetch";
import { classifyReply } from "@/lib/reply/classify";

/**
 * Reply detection — polling fallback.
 * Every 15 minutes: for each active account, list Gmail messages newer than
 * 1 day, fetch them, match threadId against emails.threadId, and run
 * classification + actions.
 */
export const pollRepliesFn = inngest.createFunction(
  {
    id: "poll-replies",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }: { step: any }) => {
    const accounts = await step.run("list-accounts", async () => {
      return db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.status, "active"));
    });

    for (const account of accounts) {
      await step.run(`poll-${account.id}`, async () => {
        try {
          await pollAccount(account.id, account.userId);
        } catch (err) {
          console.error(
            `[poll-replies] account ${account.id} failed:`,
            (err as Error).message
          );
        }
      });
    }
    return { accounts: accounts.length };
  }
);

async function pollAccount(accountId: string, userId: string): Promise<void> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const list = await listGmailMessages({
    accessToken,
    query: "newer_than:1d in:inbox",
    maxResults: 50,
  });
  if (list.length === 0) return;

  const threadIds = Array.from(new Set(list.map((m) => m.threadId)));

  // Find emails we sent that share these thread IDs
  const sentEmails = await db
    .select()
    .from(emails)
    .where(inArray(emails.threadId, threadIds));
  if (sentEmails.length === 0) return;
  const sentByThread = new Map<string, typeof sentEmails[number]>();
  for (const e of sentEmails) {
    if (e.threadId) sentByThread.set(e.threadId, e);
  }

  for (const m of list) {
    const target = sentByThread.get(m.threadId);
    if (!target) continue;

    const f = await getGmailMessage({ accessToken, id: m.id });

    // Skip messages we sent ourselves (matches our outbound provider id)
    if (target.providerMessageId === f.id) continue;

    // Idempotency
    const existing = await db
      .select({ id: replies.id })
      .from(replies)
      .where(eq(replies.emailId, target.id));
    if (existing.length > 0) continue;

    // Bounce detection
    const isBounce =
      /mailer-daemon|postmaster/i.test(f.fromAddress) ||
      /undelivered|delivery (status|failure)/i.test(f.subject);

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, target.leadId));
    if (!lead) continue;

    if (isBounce) {
      await db
        .update(emails)
        .set({ status: "bounced", bouncedAt: new Date() })
        .where(eq(emails.id, target.id));
      await db
        .update(leads)
        .set({ status: "bounced" })
        .where(eq(leads.id, lead.id));
      await db
        .insert(suppressionList)
        .values({ userId, email: lead.email, reason: "bounced" })
        .onConflictDoNothing();
      await db.insert(replies).values({
        emailId: target.id,
        rawBody: f.body,
        fromAddress: f.fromAddress,
        classification: "unrelated",
        classificationConfidence: 100,
        summary: "bounce-back",
        classifiedAt: new Date(),
      });
      continue;
    }

    const result = await classifyReply({
      subject: f.subject,
      body: f.body,
    });

    await db.insert(replies).values({
      emailId: target.id,
      rawBody: f.body,
      fromAddress: f.fromAddress,
      classification: result.classification,
      classificationConfidence: Math.round(result.confidence * 100),
      summary: result.summary,
      classifiedAt: new Date(),
    });

    await db
      .update(emails)
      .set({ repliedAt: new Date() })
      .where(eq(emails.id, target.id));

    switch (result.classification) {
      case "positive":
      case "negative":
        await db
          .update(leads)
          .set({ status: "stopped" })
          .where(eq(leads.id, lead.id));
        await inngest.send({ name: "lead/stopped", data: { leadId: lead.id } });
        break;
      case "question":
        await db
          .update(leads)
          .set({ status: "replied" })
          .where(eq(leads.id, lead.id));
        break;
      case "unsubscribe":
        await db
          .update(leads)
          .set({ status: "stopped" })
          .where(eq(leads.id, lead.id));
        await db
          .insert(suppressionList)
          .values({ userId, email: lead.email, reason: "unsubscribed" })
          .onConflictDoNothing();
        await inngest.send({ name: "lead/stopped", data: { leadId: lead.id } });
        break;
      case "out_of_office":
      case "unrelated":
      default:
        break;
    }
  }
}

void and;
