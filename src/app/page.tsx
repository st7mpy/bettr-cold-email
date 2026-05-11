import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/design";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", position: "relative", zIndex: 2 }}>
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 56px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--paper-2)",
        }}
      >
        <div className="display" style={{ fontSize: 20 }}>
          Bettr Cold Email
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/sign-in">
            <button className="btn btn-ghost btn-sm">Sign in</button>
          </Link>
          <Link href="/sign-up">
            <button className="btn btn-primary btn-sm">Get started</button>
          </Link>
        </div>
      </nav>

      {/* Hero — 2-column */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          minHeight: "90vh",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        {/* Left: manifesto */}
        <div
          style={{
            padding: "80px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderRight: "1px solid var(--hairline)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 24,
            }}
          >
            Relay / Bettr Cold Email
          </div>
          <h1
            className="display"
            style={{
              fontSize: 96,
              lineHeight: 0.92,
              letterSpacing: "-0.04em",
              marginBottom: 32,
            }}
          >
            Cold email that actually{" "}
            <em style={{ color: "var(--accent)" }}>stops</em>.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "var(--ink-2)",
              lineHeight: 1.6,
              maxWidth: 520,
              marginBottom: 36,
            }}
          >
            Real per-lead research. One-of-one drafts grounded in cited sources. And
            the discipline to pause when someone replies, bounces, or says stop.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/sign-up">
              <button className="btn btn-primary btn-lg" style={{ gap: 8 }}>
                Connect inbox
                <Icon name="arrow-right" size={16} />
              </button>
            </Link>
            <Link href="#how">
              <button className="btn btn-outline btn-lg">See it work</button>
            </Link>
          </div>

          {/* Trust strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              marginTop: 56,
              borderTop: "1px solid var(--hairline)",
              paddingTop: 28,
              gap: 0,
            }}
          >
            {[
              { num: "~1k", label: "emails / mo" },
              { num: "$0.06", label: "per lead" },
              { num: "90 s", label: "research + draft" },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  padding: "0 24px",
                  borderLeft: i > 0 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <div
                  className="display tnum"
                  style={{ fontSize: 36, color: "var(--ink)" }}
                >
                  {s.num}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    marginTop: 4,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: live trace mini-card */}
        <div
          style={{
            padding: "80px 48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--paper-2)",
          }}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 480, padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--accent)", letterSpacing: ".1em" }}
              >
                LIVE TRACE — Marcus Vance · Vellum Labs
              </span>
              <span
                className="mono"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--good)",
                  display: "inline-block",
                }}
              />
            </div>
            <div style={{ padding: "0" }}>
              {[
                {
                  t: "16:42:03",
                  ev: "web.search",
                  note: '"Marcus Vance VP Eng" → 12 results',
                },
                {
                  t: "16:42:17",
                  ev: "hook[0]",
                  note: "launched inference API at Scale · grounded=yes",
                },
                {
                  t: "16:42:24",
                  ev: "hook[1]",
                  note: "co-authored transformers paper 2023 · score 4/4",
                },
                {
                  t: "16:42:31",
                  ev: "draft.start",
                  note: "Opus · hook #0 selected",
                },
                {
                  t: "16:42:38",
                  ev: "critique",
                  note: "6/6 checks · no revision needed",
                },
                {
                  t: "16:42:41",
                  ev: "draft.complete",
                  note: "142 words · queued",
                },
              ].map((row, i, arr) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 100px 1fr",
                    padding: "10px 20px",
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    className="mono tnum"
                    style={{ fontSize: 10.5, color: "var(--muted)" }}
                  >
                    {row.t}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--accent)" }}
                  >
                    {row.ev}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-2)" }}
                  >
                    {row.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Act 1 — The promise */}
      <section
        id="how"
        style={{
          padding: "80px 56px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 48,
          }}
        >
          The argument
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 48 }}>
          {[
            {
              n: "01",
              claim: "Research first.",
              body: "Tavily pulls live pages — blog posts, talks, job listings — for each lead. The agent reads them, not just snippets.",
            },
            {
              n: "02",
              claim: "Grounded drafts.",
              body: "Every hook claim is verified before it goes into a draft. No hallucinated facts. No generic openers.",
            },
            {
              n: "03",
              claim: "Stops when it should.",
              body: "Reply detection runs every 15 minutes. One unsubscribe request removes the address everywhere, permanently.",
            },
          ].map((s) => (
            <div key={s.n}>
              <div
                className="mono tnum"
                style={{
                  fontSize: 64,
                  color: "var(--hairline)",
                  lineHeight: 1,
                  marginBottom: 20,
                  fontWeight: 500,
                }}
              >
                {s.n}
              </div>
              <div
                className="display"
                style={{ fontSize: 28, marginBottom: 12 }}
              >
                {s.claim}
              </div>
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.55 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Act 2 — How it works */}
      <section
        style={{
          padding: "80px 56px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--paper-2)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 48,
          }}
        >
          How it works
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
          }}
        >
          {[
            { step: "Upload", desc: "CSV with email + any context you have" },
            { step: "Research", desc: "Live web search per lead, cited sources" },
            { step: "Draft", desc: "One-of-one email, Opus + Haiku critique" },
            { step: "Send / Stop", desc: "Paced sends, reply detection, auto-pause" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "0 32px",
                borderLeft: i > 0 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <div
                className="mono tnum"
                style={{ fontSize: 11, color: "var(--accent)", marginBottom: 10 }}
              >
                0{i + 1}
              </div>
              <div
                className="display"
                style={{ fontSize: 24, marginBottom: 8 }}
              >
                {s.step}
              </div>
              <p
                className="mono"
                style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}
              >
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        style={{
          padding: "80px 56px",
          background: "oklch(0.12 0.005 60)",
          color: "oklch(0.96 0.006 75)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "oklch(0.55 0.006 60)",
            marginBottom: 32,
          }}
        >
          Pricing
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <div>
            <div
              className="display tnum"
              style={{ fontSize: 120, lineHeight: 0.9, color: "var(--accent)" }}
            >
              $29
            </div>
            <div
              className="mono"
              style={{
                fontSize: 13,
                color: "oklch(0.55 0.006 60)",
                marginTop: 8,
              }}
            >
              / month · 1,000 emails · API costs pass-through
            </div>
          </div>
          <div style={{ maxWidth: 400 }}>
            <p
              style={{
                fontSize: 15,
                color: "oklch(0.75 0.006 75)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              Includes research, drafting, critique, sending, and reply
              detection. No seat fees. No per-email markup beyond API cost.
            </p>
            <Link href="/sign-up">
              <button
                className="btn btn-accent btn-lg"
                style={{ gap: 8 }}
              >
                Start for free
                <Icon name="arrow-right" size={16} />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
