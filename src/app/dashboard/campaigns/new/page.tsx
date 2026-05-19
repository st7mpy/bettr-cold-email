import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { emailAccounts, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { createCampaign } from "./actions";
import { SequenceBuilder } from "./sequence-builder";
import { Icon } from "@/components/ui/design";

export const dynamic = "force-dynamic";

function Section({
  num,
  title,
  sub,
  children,
}: {
  num: number;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 8,
        }}
      >
        <span
          className="mono tnum"
          style={{
            fontSize: 11,
            color: "var(--accent)",
            letterSpacing: ".12em",
          }}
        >
          § 0{num}
        </span>
        <h2
          className="display"
          style={{ fontSize: 26, letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
      </div>
      {sub && (
        <p
          style={{
            fontSize: 13.5,
            color: "var(--muted)",
            marginBottom: 18,
            maxWidth: 540,
          }}
        >
          {sub}
        </p>
      )}
      {children}
    </section>
  );
}

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { error: errorParam } = await searchParams;

  const accounts = await db
    .select()
    .from(emailAccounts)
    .where(
      and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active"))
    );
  if (accounts.length === 0) redirect("/dashboard/settings?error=no_account");

  const [user] = await db.select().from(users).where(eq(users.id, userId));

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
          <h1
            className="display"
            style={{
              fontSize: 54,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              marginTop: 14,
            }}
          >
            New campaign
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 15,
              color: "var(--muted)",
              maxWidth: 560,
            }}
          >
            You&apos;ll draft three sample emails before launching — non-skippable.
            Trust before send.
          </p>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          Draft · auto-saved
        </div>
      </header>

      <div
        className="page-body"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 48,
          alignItems: "start",
        }}
      >
        {errorParam && (
          <div
            className="mono"
            style={{
              gridColumn: "1 / -1",
              marginBottom: 24,
              padding: "12px 16px",
              background: "oklch(0.97 0.02 25)",
              border: "1px solid var(--bad)",
              borderRadius: 6,
              fontSize: 13,
              color: "var(--bad)",
            }}
          >
            {decodeURIComponent(errorParam)}
          </div>
        )}

        <form
          action={createCampaign}
          style={{ display: "flex", flexDirection: "column", gap: 40 }}
        >
          {/* § 01 — Name */}
          <Section
            num={1}
            title="Name the campaign"
            sub="Pick something a teammate would recognize."
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="label" htmlFor="name">
                  Campaign name
                </label>
                <input
                  className="input"
                  id="name"
                  name="name"
                  placeholder="Q3 dev-tool partnerships"
                  required
                  minLength={2}
                />
              </div>
              <div>
                <label className="label" htmlFor="goalText">
                  Goal · one line
                </label>
                <input
                  className="input"
                  id="goalText"
                  name="goalText"
                  placeholder="Land 5 partnership intros with platform-eng leads"
                />
              </div>
            </div>
          </Section>

          {/* § 02 — Persona */}
          <Section
            num={2}
            title="Sender persona & value prop"
            sub="Plain language. The agent uses this verbatim — never as a merge tag."
          >
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <label className="label" htmlFor="senderPersona">
                  About you
                </label>
                <textarea
                  className="textarea"
                  id="senderPersona"
                  name="senderPersona"
                  rows={3}
                  required
                  minLength={10}
                  placeholder="I'm a founder at Margin — a review-time instrumentation tool for engineering teams. Background at Stripe and Linear."
                />
              </div>
              <div>
                <label className="label" htmlFor="valueProp">
                  What you&apos;re offering
                </label>
                <textarea
                  className="textarea"
                  id="valueProp"
                  name="valueProp"
                  rows={3}
                  required
                  minLength={10}
                  placeholder="A no-integration 2-week pilot that surfaces where reviewer time is landing per repo, per author."
                />
              </div>
            </div>
          </Section>

          {/* § 03 — Sequence */}
          <Section
            num={3}
            title="Sequence"
            sub="1–5 steps. Each step is freeform intent — not a template."
          >
            <SequenceBuilder />
          </Section>

          {/* § 04 — Leads */}
          <Section
            num={4}
            title="Upload leads"
            sub="Paste CSV. Required: email. Recommended: name, company, title, notes, linkedin_url, x_url (high-signal — scraped directly)."
          >
            <div style={{ position: "relative" }}>
              <textarea
                className="textarea textarea-mono"
                id="csvText"
                name="csvText"
                rows={9}
                required
                placeholder={`email,name,company,title,notes,linkedin_url,x_url\npriya@graphroot.dev,Priya Mehta,Graphroot,CTO,,https://linkedin.com/in/priyamehta,\nmarcus@vellum-labs.com,Marcus Vance,Vellum Labs,VP Eng,,https://linkedin.com/in/marcusvance,https://x.com/marcusv`}
              />
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 14,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6 }}
                >
                  <Icon name="upload" size={13} />
                  Upload .csv
                </button>
              </div>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}
            >
              Hard cap 5,000 rows. Sending from{" "}
              <span style={{ color: "var(--ink-2)" }}>
                {user?.postalAddress ? "your connected Gmail" : "(connect Gmail first)"}
              </span>
              .
            </div>
          </Section>

          {/* § 05 — Sending account (visible only when multiple connected) */}
          {accounts.length > 1 ? (
            <Section
              num={5}
              title="Send from"
              sub="Pick which connected inbox sends this campaign."
            >
              <select
                className="input"
                name="emailAccountId"
                defaultValue={accounts[0].id}
                style={{ maxWidth: 360 }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Account {a.id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            </Section>
          ) : (
            <input type="hidden" name="emailAccountId" value={accounts[0].id} />
          )}

          {/* Footer actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 24,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <Link href="/dashboard">
              <button type="button" className="btn btn-ghost">
                Cancel
              </button>
            </Link>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" name="_action" value="draft" className="btn btn-outline">
                Save draft
              </button>
              <button
                type="submit"
                name="_action"
                value="sample"
                className="btn btn-primary"
                style={{ gap: 8 }}
              >
                Create &amp; sample
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          </div>
        </form>

        {/* Right sidebar — explainer */}
        <aside
          style={{
            position: "sticky",
            top: 32,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Pipeline steps */}
          <div className="card" style={{ padding: 20 }}>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              The pipeline · per lead
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {[
                { label: "Pull lead data", detail: "name, title, company, notes" },
                { label: "Web research", detail: "Tavily · 3–5 sources" },
                { label: "Extract hooks", detail: "3 candidate claims" },
                { label: "Ground check", detail: "Haiku verifies each claim" },
                { label: "Draft email", detail: "Opus · best hook" },
                { label: "Critique & revise", detail: "Haiku → Opus revision" },
                { label: "Send or queue", detail: "paced · quota-gated" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px 1fr",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: i < 6 ? "1px dashed var(--hairline)" : "none",
                  }}
                >
                  <div
                    className="mono tnum"
                    style={{ fontSize: 10.5, color: "var(--muted)" }}
                  >
                    0{i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13 }}>{s.label}</div>
                    <div
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--muted)" }}
                    >
                      {s.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cost estimate */}
          <div
            className="card"
            style={{
              padding: 20,
              background: "var(--accent-soft)",
              borderColor: "var(--accent-line)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              Estimated
            </div>
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div>
                <div
                  className="display tnum"
                  style={{ fontSize: 30 }}
                >
                  ~$0.06
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}
                >
                  per lead
                </div>
              </div>
              <div>
                <div
                  className="display tnum"
                  style={{ fontSize: 30 }}
                >
                  ~90s
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}
                >
                  per lead
                </div>
              </div>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-2)",
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              You&apos;ll see 3 generated samples before any email is sent. Walk away
              if they don&apos;t pass your smell test.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
