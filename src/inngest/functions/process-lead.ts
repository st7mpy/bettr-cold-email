import { inngest } from "../client";
import { db } from "@/db";
import { leads, campaigns, sequenceSteps, leadResearch, emails } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { runResearch } from "@/lib/pipeline/research";
import { extractHooks } from "@/lib/pipeline/hooks";
import { verifyGroundedness } from "@/lib/pipeline/groundedness";
import { selectHook, draftEmail } from "@/lib/pipeline/draft";
import { critiqueDraft } from "@/lib/pipeline/critique";
import { reviseDraft } from "@/lib/pipeline/revise";

const RESEARCH_TTL_DAYS = 30;

export const processLeadFn = inngest.createFunction(
  {
    id: "process-lead",
    triggers: [{ event: "lead/process" }],
    // Global throttle to keep concurrent research polite to Tavily and bound LLM cost.
    // (Previously keyed on event.data.leadId — useless because each event has a unique leadId.)
    concurrency: { limit: 5 },
    retries: 2,
  },
  async ({ event, step }: { event: { data: { leadId: string } }; step: any }) => {
    const { leadId } = event.data;

    // 1. Load lead + campaign + first sequence step
    const ctx = await step.run("load-context", async () => {
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
      if (!lead) throw new Error(`lead ${leadId} not found`);

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, lead.campaignId));
      if (!campaign) throw new Error(`campaign ${lead.campaignId} not found`);

      const [firstStep] = await db
        .select()
        .from(sequenceSteps)
        .where(eq(sequenceSteps.campaignId, campaign.id))
        .orderBy(asc(sequenceSteps.stepIndex))
        .limit(1);
      if (!firstStep)
        throw new Error(`campaign ${campaign.id} has no sequence steps`);

      return { lead, campaign, firstStep };
    });

    await step.run("mark-researching", async () => {
      await db
        .update(leads)
        .set({ status: "researching" })
        .where(eq(leads.id, leadId));
    });

    // 2. Research — Tavily search + extract
    const research = await step.run("research", async () => {
      // Cache check first
      const [cached] = await db
        .select()
        .from(leadResearch)
        .where(eq(leadResearch.leadId, leadId));
      if (cached && cached.expiresAt.getTime() > Date.now()) {
        return {
          rawSearchResults: (cached.rawSearchResults as unknown) as ReturnType<
            typeof emptyResearch
          >["rawSearchResults"],
          fetchedPages: (cached.fetchedPages as unknown) as ReturnType<
            typeof emptyResearch
          >["fetchedPages"],
        };
      }
      const out = await runResearch({
        name: ctx.lead.name ?? "(unknown)",
        company: ctx.lead.company ?? "(unknown)",
        title: ctx.lead.title ?? undefined,
      });
      const expiresAt = new Date(
        Date.now() + RESEARCH_TTL_DAYS * 24 * 60 * 60 * 1000
      );
      await db
        .insert(leadResearch)
        .values({
          leadId,
          rawSearchResults: out.rawSearchResults,
          fetchedPages: out.fetchedPages,
          hooks: [],
          expiresAt,
        })
        .onConflictDoUpdate({
          target: leadResearch.leadId,
          set: {
            rawSearchResults: out.rawSearchResults,
            fetchedPages: out.fetchedPages,
            fetchedAt: new Date(),
            expiresAt,
          },
        });
      return out;
    });

    // 3. Extract hooks (with Opus escalation)
    const hooks = await step.run("extract-hooks", async () => {
      const extracted = await extractHooks({
        research,
        lead: {
          name: ctx.lead.name ?? "(unknown)",
          company: ctx.lead.company ?? "(unknown)",
          title: ctx.lead.title ?? undefined,
        },
      });
      await db
        .update(leadResearch)
        .set({ hooks: extracted })
        .where(eq(leadResearch.leadId, leadId));
      return extracted;
    });

    // 4. Groundedness verification
    const verifiedHooks = await step.run("verify-groundedness", async () => {
      return verifyGroundedness({
        hooks,
        pages: research.fetchedPages,
      });
    });

    // 5. Pick best hook + draft
    const selection = selectHook({
      notes: ctx.lead.notes,
      hooks: verifiedHooks,
    });

    const draft = await step.run("draft", async () =>
      draftEmail({
        selection,
        senderPersona: ctx.campaign.senderPersona,
        valueProp: ctx.campaign.valueProp,
        intentPrompt: ctx.firstStep.intentPrompt,
        recipient: {
          name: ctx.lead.name ?? "(there)",
          company: ctx.lead.company ?? "—",
          title: ctx.lead.title ?? undefined,
        },
      })
    );

    // 6. Critique
    const hookFact =
      selection.kind === "hook"
        ? selection.hook.fact
        : selection.kind === "notes"
          ? selection.text
          : null;

    const critique = await step.run("critique", async () =>
      critiqueDraft({ draft, hookFact })
    );

    // 7. Revise once if critique fails
    let finalDraft = draft;
    let finalCritique = critique;
    let needsReview = false;

    if (!critique.passes) {
      const revised = await step.run("revise", async () =>
        reviseDraft({ draft, critique, hookFact })
      );
      const recritique = await step.run("recritique", async () =>
        critiqueDraft({ draft: revised, hookFact })
      );
      finalDraft = revised;
      finalCritique = recritique;
      if (!recritique.passes) {
        needsReview = true;
      }
    }

    // 8. Persist email
    const persisted = await step.run("persist-email", async () => {
      const [row] = await db
        .insert(emails)
        .values({
          leadId,
          campaignId: ctx.campaign.id,
          stepIndex: ctx.firstStep.stepIndex,
          subject: finalDraft.subject,
          body: finalDraft.body,
          hookUsed:
            selection.kind === "hook"
              ? selection.hook
              : selection.kind === "notes"
                ? { kind: "notes", text: selection.text }
                : { kind: "no_signal" },
          status: needsReview ? "needs_review" : "queued",
        })
        .returning({ id: emails.id });
      await db
        .update(leads)
        .set({
          status: needsReview
            ? "needs_review"
            : selection.kind === "no_signal"
              ? "no_signal"
              : "ready",
        })
        .where(eq(leads.id, leadId));
      return row;
    });

    // 9. Fan out to send scheduler if the campaign is launched
    if (!needsReview && ctx.campaign.status === "launched") {
      await step.sendEvent("queue-send", {
        name: "email/send",
        data: { emailId: persisted.id },
      });
    }

    return {
      leadId,
      hookKind: selection.kind,
      critiquePassed: finalCritique.passes,
      needsReview,
    };
  }
);

// helper purely for type inference in the cache check above
function emptyResearch() {
  return { rawSearchResults: [] as Awaited<
    ReturnType<typeof runResearch>
  >["rawSearchResults"], fetchedPages: [] as Awaited<
    ReturnType<typeof runResearch>
  >["fetchedPages"] };
}

void emptyResearch;
void and;
