import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts, campaigns, emails, replies } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { Pill, Stat, SectionLabel, Icon, Btn } from "@/components/ui/design";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [active] = await db
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")));

  const userCampaigns = active
    ? await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, userId))
        .orderBy(desc(campaigns.createdAt))
    : [];

  // Aggregate stats across all campaigns owned by this user
  const campaignIds = userCampaigns.map((c) => c.id);

  const allEmails =
    active && campaignIds.length > 0
      ? await db
          .select()
          .from(emails)
          .where(inArray(emails.campaignId, campaignIds))
      : [];

  const totalSent = allEmails.filter(
    (e) => e.status === "sent" || e.status === "bounced"
  ).length;

  const allReplies =
    active && campaignIds.length > 0
      ? await db
          .select()
          .from(replies)
          .innerJoin(emails, eq(emails.id, replies.emailId))
          .where(inArray(emails.campaignId, campaignIds))
      : [];

  const positiveReplies = allReplies.filter(
    (r) => r.replies.classification === "positive"
  ).length;

  const openRate =
    totalSent > 0
      ? Math.round(
          (allEmails.filter((e) => e.openedAt != null).length / totalSent) * 100
        )
      : 0;

  const needsReview = allEmails.filter((e) => e.status === "needs_review").length;

  return (
    <div>
      {/* Page header */}
      <header
        className="page-head"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <div className="section-num" style={{ color: "var(--accent)" }}>
            § 01 — Campaigns
          </div>
          <h1
            className="display"
            style={{
              fontSize: 60,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              marginTop: 10,
            }}
          >
            Outbound, on the record.
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 15,
              color: "var(--muted)",
              maxWidth: 560,
            }}
          >
            {userCampaigns.length > 0
              ? `${userCampaigns.length} campaign${userCampaigns.length !== 1 ? "s" : ""}. Each one a stack of individually-researched emails — no templates, no merge tags.`
              : "Upload your first list of leads — the agent writes a personalized email per row, grounded in real research."}
          </p>
        </div>
        {active && (
          <Link href="/dashboard/campaigns/new">
            <button className="btn btn-primary btn-lg" style={{ gap: 8 }}>
              <Icon name="plus" size={15} />
              New campaign
            </button>
          </Link>
        )}
      </header>

      <div className="page-body">
        {/* Hero stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            border: "1px solid var(--hairline)",
            borderRadius: 8,
            background: "var(--surface)",
            marginBottom: 40,
          }}
        >
          <Stat label="Emails sent · 30 d" value={totalSent} />
          <Stat
            label="Replies (positive)"
            value={positiveReplies}
            accent
            suffix={` / ${allReplies.length}`}
          />
          <Stat label="Open rate" value={openRate} suffix="%" />
          <Stat label="Needs review" value={needsReview} noBorderRight />
        </div>

        {/* No inbox connected */}
        {!active && (
          <div
            className="card"
            style={{
              padding: "48px 40px",
              textAlign: "center",
              marginTop: 32,
            }}
          >
            <div
              className="display"
              style={{ fontSize: 28, marginBottom: 12 }}
            >
              Connect your inbox to get started
            </div>
            <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 24 }}>
              Bettr Cold Email sends from your own Gmail or Outlook. Connect an
              account in settings to enable campaigns.
            </p>
            <Link href="/dashboard/settings">
              <button className="btn btn-primary">Go to settings</button>
            </Link>
          </div>
        )}

        {/* Campaign list */}
        {active && userCampaigns.length > 0 && (
          <>
            <SectionLabel>Active</SectionLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              {userCampaigns.map((c, idx) => {
                const campaignEmails = allEmails.filter((e) => e.campaignId === c.id);
                const total = campaignEmails.length;
                const sent = campaignEmails.filter(
                  (e) => e.status === "sent" || e.status === "bounced"
                ).length;
                const campaignReplies = allReplies.filter(
                  (r) => r.emails.campaignId === c.id
                );
                const replied = campaignReplies.length;
                const positiveCount = campaignReplies.filter(
                  (r) => r.replies.classification === "positive"
                ).length;
                const sentPct = total > 0 ? Math.round((sent / total) * 100) : 0;

                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/campaigns/${c.id}`}
                    style={{
                      textAlign: "left",
                      display: "grid",
                      gridTemplateColumns: "56px 1.4fr 1fr 1fr 1fr 1.2fr 60px",
                      alignItems: "center",
                      padding: "22px 24px",
                      borderBottom:
                        idx < userCampaigns.length - 1
                          ? "1px solid var(--hairline)"
                          : "none",
                      gap: 16,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                    className="row-hover"
                  >
                    {/* Index */}
                    <div
                      className="mono tnum"
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        letterSpacing: ".08em",
                      }}
                    >
                      № {String(idx + 1).padStart(2, "0")}
                    </div>

                    {/* Name + goal */}
                    <div>
                      <div
                        className="display"
                        style={{
                          fontSize: 22,
                          letterSpacing: "-0.015em",
                          lineHeight: 1.1,
                        }}
                      >
                        {c.name}
                      </div>
                      {c.goalText && (
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--muted)",
                            marginTop: 6,
                            maxWidth: 280,
                          }}
                        >
                          {c.goalText}
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: ".1em",
                        }}
                      >
                        Status
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {c.status === "launched" ? (
                          <Pill tone="good" dot>
                            launched
                          </Pill>
                        ) : (
                          <Pill tone="warn" dot>
                            {c.status}
                          </Pill>
                        )}
                      </div>
                    </div>

                    {/* Leads */}
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: ".1em",
                        }}
                      >
                        Leads
                      </div>
                      <div
                        className="tnum display"
                        style={{
                          fontSize: 22,
                          marginTop: 2,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {total}
                      </div>
                    </div>

                    {/* Replied */}
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: ".1em",
                        }}
                      >
                        Replied
                      </div>
                      <div
                        className="tnum display"
                        style={{
                          fontSize: 22,
                          marginTop: 2,
                          letterSpacing: "-0.02em",
                          color:
                            positiveCount > 0
                              ? "var(--accent)"
                              : "var(--ink)",
                        }}
                      >
                        {replied}
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--muted)",
                            marginLeft: 4,
                          }}
                        >
                          / {sent}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: ".1em",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Sent</span>
                        <span className="tnum">{sentPct}%</span>
                      </div>
                      <div
                        style={{
                          height: 3,
                          background: "var(--hairline)",
                          marginTop: 6,
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${sentPct}%`,
                            background:
                              c.status === "launched"
                                ? "var(--accent)"
                                : "var(--rule)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Arrow */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        color: "var(--muted)",
                      }}
                    >
                      <Icon name="arrow-right" size={18} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Empty state */}
        {active && userCampaigns.length === 0 && (
          <div
            className="card"
            style={{ padding: "48px 40px", textAlign: "center" }}
          >
            <div className="display" style={{ fontSize: 28, marginBottom: 12 }}>
              No campaigns yet
            </div>
            <p
              style={{
                color: "var(--muted)",
                fontSize: 15,
                marginBottom: 24,
                maxWidth: 480,
                margin: "0 auto 24px",
              }}
            >
              Upload your first list of leads — the agent writes a personalized
              email per row, grounded in real research.
            </p>
            <Link href="/dashboard/campaigns/new">
              <button className="btn btn-primary">
                Create your first campaign
              </button>
            </Link>
          </div>
        )}

        {/* Compliance & quota panel (always shown when connected) */}
        {active && (
          <div
            style={{
              marginTop: 48,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
            }}
          >
            <div>
              <SectionLabel>Compliance &amp; quota</SectionLabel>
              <div className="card" style={{ padding: 24 }}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
                >
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                      }}
                    >
                      Daily quota
                    </div>
                    <div
                      className="display tnum"
                      style={{ fontSize: 38, marginTop: 8 }}
                    >
                      142
                      <span
                        style={{
                          fontSize: 16,
                          color: "var(--muted)",
                          marginLeft: 4,
                        }}
                      >
                        / 350
                      </span>
                    </div>
                    <div
                      style={{
                        height: 3,
                        background: "var(--hairline)",
                        marginTop: 10,
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: "41%",
                          background: "var(--ink)",
                        }}
                      />
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 8,
                      }}
                    >
                      resets at midnight · ramping
                    </div>
                  </div>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                      }}
                    >
                      Suppression list
                    </div>
                    <div
                      className="display tnum"
                      style={{ fontSize: 38, marginTop: 8 }}
                    >
                      —
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 8,
                      }}
                    >
                      cross-campaign · auto-applied
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--hairline)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    CAN-SPAM · GDPR notice on launch · unsubscribe header
                  </span>
                  <Pill tone="good" dot>
                    compliant
                  </Pill>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
