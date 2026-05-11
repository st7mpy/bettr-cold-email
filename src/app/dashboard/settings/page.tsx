import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailAccounts, suppressionList } from "@/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Pill, SectionLabel, Icon } from "@/components/ui/design";
import {
  disconnectAccount,
  sendTestEmail,
  verifyAccount,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; tested?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;

  const accounts = await db
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), ne(emailAccounts.status, "revoked")));

  const active = accounts[0];
  const verifiedEmail = active ? await verifyAccount(active.id) : null;

  const recentSuppressed = await db
    .select()
    .from(suppressionList)
    .where(eq(suppressionList.userId, userId))
    .orderBy(desc(suppressionList.createdAt))
    .limit(6);

  return (
    <div>
      {/* Page header */}
      <header className="page-head">
        <div className="section-num" style={{ color: "var(--accent)" }}>
          § 08 — Settings
        </div>
        <h1
          className="display"
          style={{
            fontSize: 54,
            lineHeight: 1,
            letterSpacing: "-0.035em",
            marginTop: 10,
          }}
        >
          Account &amp; sending.
        </h1>
      </header>

      <div className="page-body">
        {/* Banner messages */}
        {params.connected && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              background: "var(--good-soft)",
              border: "1px solid var(--good)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--good)",
            }}
            className="mono"
          >
            Connected {decodeURIComponent(params.connected)} successfully.
          </div>
        )}
        {params.tested && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              background: "var(--good-soft)",
              border: "1px solid var(--good)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--good)",
            }}
            className="mono"
          >
            Test email sent to {decodeURIComponent(params.tested)}. Check your inbox.
          </div>
        )}
        {params.error && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              background: "oklch(0.97 0.02 25)",
              border: "1px solid var(--bad)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--bad)",
            }}
            className="mono"
          >
            {decodeURIComponent(params.error)}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Connected inbox */}
            <div>
              <SectionLabel>Connected inbox</SectionLabel>
              <div className="card" style={{ padding: 24 }}>
                {!active ? (
                  <div>
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "var(--ink-2)",
                        marginBottom: 16,
                        lineHeight: 1.5,
                      }}
                    >
                      Connect your Gmail account to start sending. Replies thread
                      back to your inbox naturally.
                    </p>
                    <a href="/api/oauth/google/start" className="btn btn-primary" style={{ gap: 8 }}>
                      <Icon name="google" size={15} />
                      Connect Gmail
                    </a>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginBottom: 18,
                      }}
                    >
                      {/* Google icon block */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 6,
                          background: "var(--paper-2)",
                          border: "1px solid var(--hairline)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--ink-2)",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="google" size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {verifiedEmail ?? "(Gmail account)"}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}
                        >
                          Gmail · {active.status}
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <Pill tone={active.status === "active" ? "good" : "warn"} dot>
                          {active.status}
                        </Pill>
                      </div>
                    </div>

                    {!verifiedEmail && active.status === "active" && (
                      <p
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: "var(--warn)",
                          marginBottom: 14,
                        }}
                      >
                        Could not verify mailbox — token may need re-consent
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <form action={sendTestEmail}>
                        <input type="hidden" name="accountId" value={active.id} />
                        <button type="submit" className="btn btn-outline btn-sm">
                          Send test email
                        </button>
                      </form>
                      <a href="/api/oauth/google/start" className="btn btn-outline btn-sm">
                        Re-authorize
                      </a>
                      <form action={disconnectAccount}>
                        <input type="hidden" name="accountId" value={active.id} />
                        <button type="submit" className="btn btn-ghost btn-sm">
                          Revoke
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sending limits */}
            <div>
              <SectionLabel>Sending</SectionLabel>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "grid", gap: 18 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 14,
                    }}
                  >
                    <div>
                      <label className="label">Daily cap</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          className="input"
                          type="number"
                          defaultValue={350}
                          style={{ padding: "8px 10px" }}
                          readOnly
                        />
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)" }}
                        >
                          / day
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="label">Min gap between sends</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          className="input"
                          type="number"
                          defaultValue={30}
                          style={{ padding: "8px 10px" }}
                          readOnly
                        />
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)" }}
                        >
                          s
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    Quota ramps over 7 days: 50 → 100 → 150 → 200 → 250 → 300 → 350.
                    Resets at midnight UTC.
                  </div>
                </div>
              </div>
            </div>

            {/* Model preferences */}
            <div>
              <SectionLabel>Model preferences</SectionLabel>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label className="label">Drafting model</label>
                    <div
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--hairline)",
                        borderRadius: 4,
                        fontSize: 13,
                        color: "var(--ink-2)",
                        background: "var(--surface)",
                      }}
                    >
                      claude-opus-4-7
                    </div>
                  </div>
                  <div>
                    <label className="label">Critique model</label>
                    <div
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--hairline)",
                        borderRadius: 4,
                        fontSize: 13,
                        color: "var(--ink-2)",
                        background: "var(--surface)",
                      }}
                    >
                      claude-haiku-4-5
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    Haiku escalates to Opus when classification confidence &lt; 0.85.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Suppression preview */}
            <div>
              <SectionLabel>Suppression preview</SectionLabel>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {recentSuppressed.length === 0 ? (
                  <div
                    style={{
                      padding: "20px 18px",
                      color: "var(--muted)",
                      fontSize: 13,
                    }}
                    className="mono"
                  >
                    No suppressed addresses yet.
                  </div>
                ) : (
                  recentSuppressed.map((r, i) => (
                    <div
                      key={r.email}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        padding: "12px 18px",
                        borderBottom:
                          i < recentSuppressed.length - 1
                            ? "1px solid var(--hairline)"
                            : "none",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div className="mono" style={{ fontSize: 12.5 }}>
                          {r.email}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)" }}
                        >
                          {r.reason.replace("_", " ")}
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--muted)" }}
                      >
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))
                )}
                <div
                  style={{
                    padding: "12px 18px",
                    borderTop: "1px solid var(--hairline)",
                    display: "flex",
                    gap: 8,
                    background: "var(--paper-2)",
                  }}
                >
                  <button className="btn btn-outline btn-sm">+ Add address</button>
                  <button className="btn btn-ghost btn-sm">Import CSV</button>
                </div>
              </div>
            </div>

            {/* Usage */}
            <div>
              <SectionLabel>Usage</SectionLabel>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                      marginBottom: 8,
                    }}
                  >
                    Emails sent this month
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <span className="display tnum" style={{ fontSize: 32 }}>
                      0
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 13, color: "var(--muted)" }}
                    >
                      / 1,000
                    </span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: "var(--hairline)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ height: "100%", width: "0%", background: "var(--ink)" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                        marginBottom: 6,
                      }}
                    >
                      API spend
                    </div>
                    <div className="display tnum" style={{ fontSize: 28 }}>
                      $0.00
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 4,
                      }}
                    >
                      $0.065 / email avg
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
                        marginBottom: 6,
                      }}
                    >
                      Leads researched
                    </div>
                    <div className="display tnum" style={{ fontSize: 28 }}>
                      0
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
