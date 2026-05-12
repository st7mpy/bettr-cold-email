import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { campaigns, leads, emails, sequenceSteps, replies } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { generateSamples, launchCampaign } from "../new/actions";
import { computeCampaignStats } from "@/lib/campaign/stats";
import { Pill, Stat, SectionLabel, StatusDot, Icon } from "@/components/ui/design";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ sampling?: string; launched?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { campaignId } = await params;
  const sp = await searchParams;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  if (!campaign) notFound();

  const allSteps = await db
    .select()
    .from(sequenceSteps)
    .where(eq(sequenceSteps.campaignId, campaign.id))
    .orderBy(sequenceSteps.stepIndex);

  const allLeads = await db
    .select()
    .from(leads)
    .where(eq(leads.campaignId, campaign.id))
    .orderBy(desc(leads.createdAt));

  const totalLeads = allLeads.length;

  const allEmails = await db
    .select()
    .from(emails)
    .where(eq(emails.campaignId, campaign.id));

  const stats = computeCampaignStats(allEmails);

  // Count positive replies for this campaign
  const emailIds = allEmails.map((e) => e.id);
  let positive = 0;
  if (emailIds.length > 0) {
    const positiveReplies = await db
      .select({ id: replies.id })
      .from(replies)
      .where(and(inArray(replies.emailId, emailIds), eq(replies.classification, "positive")));
    positive = positiveReplies.length;
  }

  const recentEmails = await db
    .select({
      id: emails.id,
      leadId: emails.leadId,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
      threadId: emails.threadId,
      createdAt: emails.createdAt,
      leadEmail: leads.email,
      leadName: leads.name,
    })
    .from(emails)
    .innerJoin(leads, eq(emails.leadId, leads.id))
    .where(eq(emails.campaignId, campaign.id))
    .orderBy(desc(emails.createdAt))
    .limit(1);

  const spotlightEmail = recentEmails[0] ?? null;
  const isDraft = campaign.status === "draft";
  const replied = allLeads.filter((l) => l.status === "replied").length;

  return (
    <div>
      {/* Page header */}
      <header className="page-head">
        <Link
          href="/dashboard"
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          ← Campaigns
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginTop: 14,
          }}
        >
          <div>
            <h1
              className="display"
              style={{
                fontSize: 64,
                lineHeight: 0.95,
                letterSpacing: "-0.035em",
                maxWidth: 760,
              }}
            >
              {campaign.name}
            </h1>
            {campaign.goalText && (
              <p
                style={{
                  marginTop: 14,
                  fontSize: 15,
                  color: "var(--muted)",
                  maxWidth: 560,
                }}
              >
                {campaign.goalText}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Pill tone={campaign.status === "launched" ? "good" : "warn"} dot>
                {campaign.status}
              </Pill>
              {campaign.createdAt && (
                <Pill>
                  created{" "}
                  {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Pill>
              )}
              {allSteps.length > 0 && (
                <Pill>{allSteps.length}-step sequence</Pill>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {isDraft ? (
              <>
                <form
                  action={async () => {
                    "use server";
                    await generateSamples(campaign.id);
                  }}
                >
                  <button type="submit" className="btn btn-outline">
                    Generate samples
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await launchCampaign(campaign.id);
                  }}
                >
                  <button type="submit" className="btn btn-primary">
                    Launch all
                  </button>
                </form>
              </>
            ) : (
              <>
                <button className="btn btn-outline">Pause</button>
                <button className="btn btn-outline">
                  <Icon name="external" size={14} />
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Banners */}
      {sp.sampling && (
        <div
          style={{
            margin: "0 56px",
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-line)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--accent)",
          }}
          className="mono"
        >
          Sampling 3 leads — usually 30–60 s. Refresh to see results.
        </div>
      )}
      {sp.launched && (
        <div
          style={{
            margin: "0 56px",
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--good-soft)",
            border: "1px solid var(--good)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--good)",
          }}
          className="mono"
        >
          Campaign launched. All leads are queued through the pipeline.
        </div>
      )}

      <div className="page-body">
        {/* Editorial stat band */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
            border: "1px solid var(--hairline)",
            borderRadius: 8,
            background: "var(--surface)",
            marginBottom: 40,
          }}
        >
          {/* Progress */}
          <div
            style={{
              padding: "22px 28px",
              borderRight: "1px solid var(--hairline)",
              background: "var(--paper-2)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Progress
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginTop: 10,
              }}
            >
              <span
                className="display tnum"
                style={{ fontSize: 54, letterSpacing: "-0.03em" }}
              >
                {stats.sent}
              </span>
              <span className="mono" style={{ fontSize: 14, color: "var(--muted)" }}>
                / {totalLeads} sent
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "var(--hairline)",
                marginTop: 14,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${totalLeads > 0 ? (stats.sent / totalLeads) * 100 : 0}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}
            >
              {totalLeads - stats.sent} queued · paced 30–120s between sends
            </div>
          </div>

          <Stat label="Open rate" value={stats.openRate} suffix="%" />
          <Stat label="Click rate" value={stats.clickRate} suffix="%" />
          <Stat label="Reply rate" value={stats.replyRate} accent suffix="%" />
          <Stat
            label="Positive"
            value={positive}
            sub={`${replied - positive} other · ${totalLeads - stats.sent} queued`}
            noBorderRight
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 48 }}
        >
          {/* Leads table */}
          <div>
            <SectionLabel>
              Leads · {allLeads.length} of {totalLeads}
            </SectionLabel>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 90px 28px",
                  padding: "10px 18px",
                  borderBottom: "1px solid var(--hairline)",
                  background: "var(--paper-2)",
                }}
              >
                {["Lead", "Company · title", "Status", ""].map((h) => (
                  <span
                    key={h}
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {allLeads.length === 0 && (
                <div
                  style={{
                    padding: "24px 18px",
                    color: "var(--muted)",
                    fontSize: 13,
                  }}
                  className="mono"
                >
                  No leads uploaded yet.
                </div>
              )}

              {allLeads.map((l, i) => (
                <Link
                  key={l.id}
                  href={`/dashboard/campaigns/${campaign.id}/leads/${l.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 90px 28px",
                    padding: "14px 18px",
                    alignItems: "center",
                    borderBottom:
                      i < allLeads.length - 1
                        ? "1px solid var(--hairline)"
                        : "none",
                    textAlign: "left",
                    gap: 8,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--paper-2)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {l.name ?? "—"}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: "var(--muted)" }}
                    >
                      {l.email}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13 }}>{l.company ?? "—"}</div>
                    <div
                      className="mono"
                      style={{ fontSize: 11, color: "var(--muted)" }}
                    >
                      {l.title ?? "—"}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <StatusDot status={l.status} />
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--ink-2)" }}
                    >
                      {l.status.replace("_", " ")}
                    </span>
                  </div>
                  <Icon name="arrow-right" size={14} />
                </Link>
              ))}
            </div>
          </div>

          {/* Right column: sequence + spotlight email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Sequence */}
            {allSteps.length > 0 && (
              <div>
                <SectionLabel>Sequence</SectionLabel>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {allSteps.map((step, i) => (
                    <div
                      key={step.id}
                      style={{
                        padding: "16px 18px",
                        borderBottom:
                          i < allSteps.length - 1
                            ? "1px solid var(--hairline)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          className="mono tnum"
                          style={{
                            fontSize: 11,
                            color: "var(--accent)",
                            letterSpacing: ".1em",
                          }}
                        >
                          STEP 0{i + 1}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)" }}
                        >
                          {step.delayDays === 0
                            ? "on launch"
                            : `+${step.delayDays} days`}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--ink-2)",
                          lineHeight: 1.5,
                        }}
                      >
                        {step.intentPrompt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spotlight email */}
            {spotlightEmail && (
              <div>
                <SectionLabel>Most recent send</SectionLabel>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--hairline)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--muted)" }}
                    >
                      to {spotlightEmail.leadEmail}
                    </span>
                    <Pill tone="good" dot>
                      {spotlightEmail.status}
                    </Pill>
                  </div>
                  <div style={{ padding: 18 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        marginBottom: 10,
                      }}
                    >
                      {spotlightEmail.subject}
                    </div>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "var(--ink-2)",
                      }}
                    >
                      {spotlightEmail.body.slice(0, 310)}
                      {spotlightEmail.body.length > 310 ? "…" : ""}
                    </pre>
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}/leads/${spotlightEmail.leadId}`}
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--accent)",
                        marginTop: 10,
                        letterSpacing: ".06em",
                        display: "inline-block",
                      }}
                    >
                      VIEW FULL TRACE →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Draft CTA */}
            {isDraft && allLeads.length > 0 && (
              <div>
                <SectionLabel>Launch</SectionLabel>
                <div className="card" style={{ padding: 24 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ink-2)",
                      lineHeight: 1.5,
                      marginBottom: 16,
                    }}
                  >
                    Generate 3 sample emails to QA the agent output, then launch
                    when satisfied.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <form
                      action={async () => {
                        "use server";
                        await generateSamples(campaign.id);
                      }}
                    >
                      <button type="submit" className="btn btn-outline">
                        Generate samples
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await launchCampaign(campaign.id);
                      }}
                    >
                      <button type="submit" className="btn btn-primary">
                        Launch all
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
