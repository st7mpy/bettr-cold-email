import { inngest } from "../client";
import { db } from "@/db";
import {
  emails,
  emailAccounts,
  leads,
  campaigns,
  suppressionList,
  users,
  sequenceSteps,
  usageLog,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAccessTokenForAccount } from "@/lib/oauth/tokens";
import { sendMessage } from "@/lib/email/send";
import { wrapTrackingForBody } from "@/lib/email/wrap";

// Pacing: random gap between sends per account (humanize timing)
function randomGapSeconds(): number {
  return 30 + Math.floor(Math.random() * 90); // 30..120s
}

export const sendEmailFn = inngest.createFunction(
  {
    id: "send-email",
    triggers: [{ event: "email/send" }],
    // Per-account concurrency 1: serialize sends from a single inbox
    concurrency: { limit: 1, key: "event.data.emailId" },
    retries: 3,
  },
  async ({
    event,
    step,
  }: {
    event: { data: { emailId: string } };
    step: any;
  }) => {
    const { emailId } = event.data;

    const ctx = await step.run("load", async () => {
      const [email] = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId));
      if (!email) throw new Error(`email ${emailId} not found`);
      if (email.status !== "queued") {
        return { skip: true as const, reason: `status=${email.status}` };
      }

      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, email.leadId));
      if (!lead) throw new Error(`lead ${email.leadId} not found`);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, email.campaignId));
      if (!campaign) throw new Error(`campaign ${email.campaignId} not found`);

      // Use the campaign's designated account if set; fall back to first active
      const accountQuery = campaign.emailAccountId
        ? db
            .select()
            .from(emailAccounts)
            .where(eq(emailAccounts.id, campaign.emailAccountId))
        : db
            .select()
            .from(emailAccounts)
            .where(
              and(
                eq(emailAccounts.userId, campaign.userId),
                eq(emailAccounts.status, "active")
              )
            );
      const [account] = await accountQuery;
      if (!account || account.status !== "active") {
        return { skip: true as const, reason: "no_active_account" };
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, campaign.userId));
      if (!user) throw new Error(`user ${campaign.userId} not found`);

      // suppression check
      const [supp] = await db
        .select()
        .from(suppressionList)
        .where(
          and(
            eq(suppressionList.userId, campaign.userId),
            eq(suppressionList.email, lead.email)
          )
        );
      if (supp) return { skip: true as const, reason: "suppressed" };

      // Lead must still be active
      if (
        lead.status === "stopped" ||
        lead.status === "bounced" ||
        lead.status === "replied"
      ) {
        return { skip: true as const, reason: `lead_${lead.status}` };
      }

      return { skip: false as const, email, lead, campaign, account, user };
    });

    if (ctx.skip) {
      return { skipped: true, reason: ctx.reason };
    }

    // Quota check + pacing — read fresh quota row inside the same step
    const quota = await step.run("quota-check", async () => {
      const [acc] = await db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.id, ctx.account.id));
      if (acc.sentToday >= acc.dailyQuota) {
        return { ok: false as const };
      }
      return { ok: true as const };
    });

    if (!quota.ok) {
      // Reschedule for ~next morning UTC
      const now = new Date();
      const tomorrow = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1,
          7,
          0,
          0
        )
      );
      await step.sleepUntil("until-tomorrow", tomorrow);
      // Re-fire ourselves
      await step.sendEvent("requeue", {
        name: "email/send",
        data: { emailId },
      });
      return { requeued: true };
    }

    // Random pacing gap
    await step.sleep("pacing", `${randomGapSeconds()}s`);

    // Wrap tracking + unsubscribe
    const wrapped = wrapTrackingForBody({
      emailId: ctx.email.id,
      body: ctx.email.body,
    });

    const accessToken = await step.run("token", () =>
      getAccessTokenForAccount(ctx.account.id)
    );

    const sendResult = await step.run("send", async () => {
      return sendMessage(ctx.account, accessToken, {
        from: ctx.user.email,
        to: ctx.lead.email,
        subject: ctx.email.subject,
        body: wrapped.body,
        headers: {
          "List-Unsubscribe": `<${wrapped.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        threadId: ctx.email.threadId ?? undefined,
      });
    });

    await step.run("mark-sent", async () => {
      await db
        .update(emails)
        .set({
          status: "sent",
          sentAt: new Date(),
          providerMessageId: sendResult.messageId,
          threadId: sendResult.threadId,
        })
        .where(eq(emails.id, emailId));
      await db
        .update(leads)
        .set({ status: "sent" })
        .where(eq(leads.id, ctx.lead.id));
      await db
        .update(emailAccounts)
        .set({ sentToday: ctx.account.sentToday + 1 })
        .where(eq(emailAccounts.id, ctx.account.id));
      await db.insert(usageLog).values({
        userId: ctx.campaign.userId,
        campaignId: ctx.campaign.id,
        model: "opus",
        inputTokens: 2000,
        outputTokens: Math.ceil(
          (ctx.email.body.length + ctx.email.subject.length) / 4
        ),
      });
    });

    // Schedule follow-up if next sequence step exists with delay > 0
    await step.run("schedule-follow-up", async () => {
      const next = await db
        .select()
        .from(sequenceSteps)
        .where(
          and(
            eq(sequenceSteps.campaignId, ctx.campaign.id),
            eq(sequenceSteps.stepIndex, ctx.email.stepIndex + 1)
          )
        );
      if (next.length > 0) {
        await inngest.send({
          name: "lead/follow-up",
          data: {
            leadId: ctx.lead.id,
            nextStepIndex: ctx.email.stepIndex + 1,
          },
        });
      }
    });

    return { sent: true, messageId: sendResult.messageId };
  }
);
