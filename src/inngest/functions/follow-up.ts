import { inngest } from "../client";
import { db } from "@/db";
import {
  leads,
  campaigns,
  sequenceSteps,
  leadResearch,
  emails,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { extractHooks } from "@/lib/pipeline/hooks";
import { verifyGroundedness } from "@/lib/pipeline/groundedness";
import { selectHook, draftEmail } from "@/lib/pipeline/draft";
import { critiqueDraft } from "@/lib/pipeline/critique";
import { reviseDraft } from "@/lib/pipeline/revise";

/**
 * Sequence follow-up: reuses cached lead_research, regenerates the email
 * body for the next step's intentPrompt, and queues it. Sleeps for the
 * configured `delayDays` first.
 */
export const followUpFn = inngest.createFunction(
  {
    id: "lead-follow-up",
    triggers: [{ event: "lead/follow-up" }],
    concurrency: { limit: 5, key: "event.data.leadId" },
    retries: 2,
  },
  async ({
    event,
    step,
  }: {
    event: { data: { leadId: string; nextStepIndex: number } };
    step: any;
  }) => {
    const { leadId, nextStepIndex } = event.data;

    const ctx = await step.run("load", async () => {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      if (!lead) throw new Error(`lead ${leadId} not found`);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, lead.campaignId));
      if (!campaign) throw new Error(`campaign ${lead.campaignId} not found`);

      const [seqStep] = await db
        .select()
        .from(sequenceSteps)
        .where(
          and(
            eq(sequenceSteps.campaignId, campaign.id),
            eq(sequenceSteps.stepIndex, nextStepIndex)
          )
        );
      if (!seqStep)
        throw new Error(
          `step ${nextStepIndex} not found for campaign ${campaign.id}`
        );

      const [research] = await db
        .select()
        .from(leadResearch)
        .where(eq(leadResearch.leadId, leadId));

      return { lead, campaign, seqStep, research };
    });

    if (
      ctx.lead.status === "stopped" ||
      ctx.lead.status === "bounced" ||
      ctx.lead.status === "replied"
    ) {
      return { skipped: ctx.lead.status };
    }

    if (ctx.seqStep.delayDays > 0) {
      await step.sleep(
        "delay",
        `${ctx.seqStep.delayDays * 24}h`
      );
    }

    // Re-check after delay
    const fresh = await step.run("recheck", async () => {
      const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
      return l;
    });
    if (
      fresh.status === "stopped" ||
      fresh.status === "bounced" ||
      fresh.status === "replied"
    ) {
      return { skipped: fresh.status };
    }

    // Reuse research; if it's missing, fall back to no-signal selection.
    let verifiedHooks: Awaited<ReturnType<typeof verifyGroundedness>> = [];
    if (ctx.research) {
      const hooks = await step.run("extract-hooks", () =>
        extractHooks({
          research: {
            rawSearchResults: (ctx.research?.rawSearchResults ?? []) as any,
            fetchedPages: (ctx.research?.fetchedPages ?? []) as any,
          },
          lead: {
            name: ctx.lead.name ?? "(unknown)",
            company: ctx.lead.company ?? "(unknown)",
            title: ctx.lead.title ?? undefined,
          },
        })
      );
      verifiedHooks = await step.run("verify", () =>
        verifyGroundedness({
          hooks,
          pages: (ctx.research?.fetchedPages ?? []) as any,
        })
      );
    }

    const selection = selectHook({
      notes: ctx.lead.notes,
      hooks: verifiedHooks,
    });

    const draft = await step.run("draft", () =>
      draftEmail({
        selection,
        senderPersona: ctx.campaign.senderPersona,
        valueProp: ctx.campaign.valueProp,
        intentPrompt: ctx.seqStep.intentPrompt,
        recipient: {
          name: ctx.lead.name ?? "(there)",
          company: ctx.lead.company ?? "—",
          title: ctx.lead.title ?? undefined,
        },
      })
    );

    const hookFact =
      selection.kind === "hook"
        ? selection.hook.fact
        : selection.kind === "notes"
          ? selection.text
          : null;

    const critique = await step.run("critique", () =>
      critiqueDraft({ draft, hookFact })
    );

    let finalDraft = draft;
    let needsReview = false;
    if (!critique.passes) {
      const revised = await step.run("revise", () =>
        reviseDraft({ draft, critique, hookFact })
      );
      const recritique = await step.run("recritique", () =>
        critiqueDraft({ draft: revised, hookFact })
      );
      finalDraft = revised;
      needsReview = !recritique.passes;
    }

    // Find the previous email's threadId so we reply into the same Gmail thread.
    const [prevEmail] = await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.leadId, leadId),
          eq(emails.stepIndex, nextStepIndex - 1)
        )
      );

    const [persisted] = await step.run("persist-email", async () => {
      return db
        .insert(emails)
        .values({
          leadId,
          campaignId: ctx.campaign.id,
          stepIndex: nextStepIndex,
          subject: finalDraft.subject,
          body: finalDraft.body,
          hookUsed:
            selection.kind === "hook"
              ? selection.hook
              : selection.kind === "notes"
                ? { kind: "notes", text: selection.text }
                : { kind: "no_signal" },
          threadId: prevEmail?.threadId ?? null,
          status: needsReview ? "needs_review" : "queued",
        })
        .returning({ id: emails.id });
    });

    if (!needsReview) {
      await inngest.send({
        name: "email/send",
        data: { emailId: persisted.id },
      });
    }

    return { emailId: persisted.id, needsReview };
  }
);
