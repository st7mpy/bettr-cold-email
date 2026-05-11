"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon, Pill } from "@/components/ui/design";

interface SearchHit {
  url: string;
  title: string;
  content: string;
}

interface ResearchHook {
  type: "person_hook" | "company_hook";
  source_url: string;
  fact: string;
  quoted_phrase: string | null;
  why_relevant: string;
  recency_days: number | null;
  specificity_score: number;
}

interface EmailRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  stepIndex: number;
  hookUsed: unknown;
  createdAt: Date | null;
}

interface Lead {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  title: string | null;
  status: string;
}

interface Props {
  campaignId: string;
  campaignName: string;
  lead: Lead;
  searchHits: SearchHit[];
  hooks: ResearchHook[];
  emails: EmailRow[];
  hasResearch: boolean;
}

function ScoreDots({ score }: { score: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 1,
            background: i <= score ? "var(--accent)" : "var(--hairline)",
          }}
        />
      ))}
    </span>
  );
}

function TraceBlock({
  num,
  title,
  sub,
  active,
  children,
}: {
  num: number;
  title: string;
  sub: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="fade-up">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 6,
        }}
      >
        <span
          className="mono tnum"
          style={{
            fontSize: 11,
            color: active ? "var(--accent)" : "var(--muted)",
            letterSpacing: ".12em",
          }}
        >
          § 0{num}
        </span>
        <h2
          className="display"
          style={{ fontSize: 24, letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
        {active && (
          <span
            className="mono caret"
            style={{ fontSize: 10.5, color: "var(--accent)", marginLeft: "auto" }}
          />
        )}
      </div>
      <p
        className="mono"
        style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}
      >
        {sub}
      </p>
      {children}
    </section>
  );
}

export function LeadTraceClient({
  campaignId,
  campaignName,
  lead,
  searchHits,
  hooks,
  emails,
  hasResearch,
}: Props) {
  const [animMode, setAnimMode] = useState<"auto" | "done">("auto");
  const [step, setStep] = useState(0);
  const [revealedSrc, setRevealedSrc] = useState(0);
  const [revealedHooks, setRevealedHooks] = useState(0);
  const [revealedChecks, setRevealedChecks] = useState(0);
  const [draftIdx, setDraftIdx] = useState(0);

  const latestEmail = emails[0];
  const eligibleHooks = hooks.filter((h) => h.specificity_score >= 2);
  const allChecks = ["specific_claim", "no_flattery", "under_150_words", "cta_present", "no_merge_tags", "grounded"];

  function replay() {
    setStep(0);
    setRevealedSrc(0);
    setRevealedHooks(0);
    setRevealedChecks(0);
    setDraftIdx(0);
    setAnimMode("auto");
  }

  useEffect(() => {
    if (animMode !== "auto" || !hasResearch) {
      if (!hasResearch) setAnimMode("done");
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const push = (fn: () => void, t: number) =>
      timers.push(setTimeout(() => !cancelled && fn(), t));

    let t = 300;

    // Reveal sources
    searchHits.forEach((_, i) => {
      push(() => setRevealedSrc(i + 1), t);
      t += 380;
    });
    push(() => setStep(1), t);
    t += 400;

    // Reveal hooks
    hooks.forEach((_, i) => {
      push(() => setRevealedHooks(i + 1), t);
      t += 380;
    });
    push(() => setStep(2), t);
    t += 600;

    // Verify step
    push(() => setStep(3), t);
    t += 600;

    // Draft typewriter
    if (latestEmail) {
      const body = latestEmail.body;
      for (let i = 0; i <= body.length; i += 4) {
        push(() => setDraftIdx(i), t);
        t += 10;
      }
      push(() => setDraftIdx(body.length), t);
      t += 100;
    }
    push(() => setStep(4), t);
    t += 300;

    // Critique checks
    allChecks.forEach((_, i) => {
      push(() => setRevealedChecks(i + 1), t);
      t += 220;
    });
    push(() => setStep(5), t);
    t += 100;
    push(() => setAnimMode("done"), t);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animMode]);

  const timelineItems = [
    { n: "01", t: "Sources", done: step > 0 },
    { n: "02", t: "Hooks", done: step > 1 },
    { n: "03", t: "Verify", done: step > 2 },
    { n: "04", t: "Draft", done: step > 3 },
    { n: "05", t: "Critique", done: step > 4 },
    { n: "06", t: "Complete", done: animMode === "done" },
  ];

  return (
    <div>
      {/* Page header */}
      <header className="page-head">
        <Link
          href={`/dashboard/campaigns/${campaignId}`}
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          ← {campaignName}
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginTop: 16,
          }}
        >
          <div>
            <div className="section-num" style={{ color: "var(--accent)" }}>
              Dossier — {lead.company ?? "Unknown company"}
            </div>
            <h1
              className="display"
              style={{
                fontSize: 60,
                letterSpacing: "-0.035em",
                lineHeight: 0.95,
                marginTop: 12,
              }}
            >
              {lead.name ?? lead.email}
              <span
                style={{
                  color: "var(--muted)",
                  fontStyle: "italic",
                  fontSize: "0.62em",
                }}
              >
                {" "}
                · {lead.title ?? ""}
              </span>
            </h1>
            <div
              className="mono"
              style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}
            >
              {lead.email}
              {lead.company ? ` · ${lead.company}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {latestEmail && (
              <Pill tone="good" dot>
                {latestEmail.status}
              </Pill>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={replay}
              style={{ gap: 6 }}
            >
              Replay trace
            </button>
          </div>
        </div>
      </header>

      <div
        className="page-body"
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: 32,
        }}
      >
        {/* Timeline rail */}
        <aside style={{ position: "sticky", top: 24, height: "max-content" }}>
          {timelineItems.map((s, i, arr) => (
            <div
              key={s.n}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr",
                gap: 10,
                paddingBottom: i < arr.length - 1 ? 20 : 0,
                position: "relative",
              }}
            >
              {i < arr.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: 11,
                    top: 22,
                    bottom: 0,
                    width: 1,
                    background: s.done ? "var(--accent)" : "var(--hairline)",
                    transition: "background 200ms",
                  }}
                />
              )}
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `1px solid ${s.done || step === i ? "var(--accent)" : "var(--hairline)"}`,
                  background: s.done
                    ? "var(--accent)"
                    : step === i
                      ? "var(--accent-soft)"
                      : "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: s.done ? "var(--accent-ink)" : "var(--muted)",
                  transition: "all 200ms",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {s.done ? (
                  <Icon name="check" size={11} stroke={2} />
                ) : (
                  <span className="mono">{s.n}</span>
                )}
              </div>
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--muted)",
                    letterSpacing: ".1em",
                  }}
                >
                  § {s.n}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: step === i ? 500 : 400,
                    color:
                      step === i
                        ? "var(--ink)"
                        : s.done
                          ? "var(--ink-2)"
                          : "var(--muted)",
                  }}
                >
                  {s.t}
                </div>
              </div>
            </div>
          ))}
        </aside>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {!hasResearch ? (
            <div className="card" style={{ padding: "32px 28px" }}>
              <div className="display" style={{ fontSize: 24, marginBottom: 10 }}>
                No research yet
              </div>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>
                The pipeline hasn&apos;t reached this lead. Generate samples or
                launch the campaign to kick it off.
              </p>
            </div>
          ) : (
            <>
              {/* § 01 Sources */}
              <TraceBlock
                num={1}
                title="Reading top results"
                sub="Full-page extract via Tavily, not just snippets"
                active={step === 0}
              >
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {searchHits.slice(0, revealedSrc).map((src, i) => (
                    <div
                      key={i}
                      className="fade-up"
                      style={{
                        padding: "14px 18px",
                        borderBottom:
                          i < revealedSrc - 1
                            ? "1px solid var(--hairline)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 14,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13.5,
                              fontWeight: 500,
                              color: "var(--ink)",
                            }}
                          >
                            {src.title || src.url}
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: "var(--accent)",
                              marginTop: 4,
                              display: "inline-block",
                            }}
                          >
                            {src.url.slice(0, 60)}
                            {src.url.length > 60 ? "…" : ""} ↗
                          </a>
                          {src.content && (
                            <p
                              style={{
                                fontSize: 12.5,
                                color: "var(--ink-2)",
                                marginTop: 8,
                                lineHeight: 1.55,
                                paddingLeft: 12,
                                borderLeft: "2px solid var(--hairline)",
                              }}
                            >
                              {src.content.slice(0, 200)}
                              {src.content.length > 200 ? "…" : ""}
                            </p>
                          )}
                        </div>
                        <div
                          style={{
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            color: "var(--good)",
                          }}
                        >
                          <Icon name="check" size={12} stroke={2} />
                          <span className="mono" style={{ fontSize: 11 }}>
                            extracted
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {revealedSrc < searchHits.length && (
                    <div
                      style={{
                        padding: "11px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: "var(--muted)",
                        fontSize: 12,
                      }}
                    >
                      <span
                        className="shimmer"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          flexShrink: 0,
                        }}
                      />
                      <span className="mono">fetching…</span>
                    </div>
                  )}
                </div>
              </TraceBlock>

              {/* § 02 Hooks */}
              {step >= 1 && (
                <TraceBlock
                  num={2}
                  title="Hooks · ranked by specificity"
                  sub="Score = date + named entity + quote + non-year number. Threshold ≥ 2."
                  active={step === 1}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {hooks.slice(0, revealedHooks).map((h, i) => {
                      const dropped = h.specificity_score < 2;
                      const isTop = i === 0 && !dropped;
                      return (
                        <div
                          key={i}
                          className="fade-up card"
                          style={{
                            padding: "16px 18px",
                            background: dropped
                              ? "var(--paper-2)"
                              : isTop
                                ? "var(--accent-soft)"
                                : "var(--surface)",
                            borderColor: dropped
                              ? "var(--hairline)"
                              : isTop
                                ? "var(--accent-line)"
                                : "var(--hairline)",
                            opacity: dropped ? 0.6 : 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 10.5,
                                padding: "2px 8px",
                                border: "1px solid var(--hairline)",
                                borderRadius: 3,
                                color: "var(--ink-2)",
                                background: "var(--surface)",
                              }}
                            >
                              {h.type === "person_hook" ? "person" : "company"}
                            </span>
                            <ScoreDots score={h.specificity_score} />
                            <span
                              className="mono tnum"
                              style={{ fontSize: 11, color: "var(--muted)" }}
                            >
                              score {h.specificity_score}/4
                            </span>
                            {h.recency_days != null && (
                              <span
                                className="mono"
                                style={{ fontSize: 11, color: "var(--muted)" }}
                              >
                                · {h.recency_days}d ago
                              </span>
                            )}
                            <span style={{ flex: 1 }} />
                            {dropped ? (
                              <Pill>dropped · below threshold</Pill>
                            ) : isTop ? (
                              <Pill tone="accent" dot>
                                used in draft
                              </Pill>
                            ) : (
                              <Pill tone="good" dot>
                                eligible
                              </Pill>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              color: "var(--ink)",
                              lineHeight: 1.5,
                            }}
                          >
                            {h.fact}
                          </div>
                          {h.quoted_phrase && (
                            <div
                              style={{
                                marginTop: 10,
                                paddingLeft: 12,
                                borderLeft: `2px solid ${isTop ? "var(--accent)" : "var(--rule)"}`,
                                fontSize: 13,
                                fontStyle: "italic",
                                color: "var(--ink-2)",
                                lineHeight: 1.55,
                              }}
                            >
                              &quot;{h.quoted_phrase}&quot;
                            </div>
                          )}
                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: "1px dashed var(--hairline)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 14,
                            }}
                          >
                            <span
                              className="mono"
                              style={{ fontSize: 11, color: "var(--muted)" }}
                            >
                              {h.source_url.slice(0, 50)}
                              {h.source_url.length > 50 ? "…" : ""}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              {h.why_relevant}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TraceBlock>
              )}

              {/* § 03 Verify */}
              {step >= 2 && (
                <TraceBlock
                  num={3}
                  title="Groundedness verification"
                  sub="Separate Haiku call per hook: does the page actually say this?"
                  active={step === 2}
                >
                  <div className="card" style={{ padding: "16px 18px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 12,
                      }}
                    >
                      {eligibleHooks.slice(0, 3).map((h, i) => (
                        <div
                          key={i}
                          className="fade-up"
                          style={{
                            padding: "12px 14px",
                            border: "1px solid var(--hairline)",
                            borderRadius: 6,
                            background: "var(--paper-2)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <Icon
                              name="check"
                              size={13}
                              stroke={2}
                              style={{ color: "var(--good)" }}
                            />
                            <span
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: "var(--good)",
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                              }}
                            >
                              supported
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--ink-2)",
                              lineHeight: 1.45,
                            }}
                          >
                            {h.fact.slice(0, 80)}
                            {h.fact.length > 80 ? "…" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px dashed var(--hairline)",
                      }}
                    >
                      {eligibleHooks.length} / {hooks.length} hooks passed
                      verification
                    </div>
                  </div>
                </TraceBlock>
              )}

              {/* § 04 Draft */}
              {step >= 3 && latestEmail && (
                <TraceBlock
                  num={4}
                  title="Drafting the email"
                  sub="Opus · must cite one of the verified hooks · ≤ 150 words"
                  active={step === 3}
                >
                  <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        padding: "12px 18px",
                        borderBottom: "1px solid var(--hairline)",
                        background: "var(--paper-2)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".06em" }}
                      >
                        Hook cited: #01 · person_hook
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--accent)" }}
                      >
                        opus 4.7
                      </span>
                    </div>
                    <div style={{ padding: "22px 24px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "60px 1fr",
                          rowGap: 6,
                          fontSize: 12.5,
                          paddingBottom: 14,
                          borderBottom: "1px solid var(--hairline)",
                        }}
                      >
                        <span className="mono" style={{ color: "var(--muted)" }}>
                          to
                        </span>
                        <span>{lead.email}</span>
                        <span className="mono" style={{ color: "var(--muted)" }}>
                          subj
                        </span>
                        <span style={{ fontWeight: 500 }}>{latestEmail.subject}</span>
                      </div>
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                          fontSize: 14,
                          lineHeight: 1.65,
                          padding: "18px 0",
                          color: "var(--ink-2)",
                          minHeight: 160,
                        }}
                      >
                        {latestEmail.body.slice(0, draftIdx)}
                        {draftIdx < latestEmail.body.length && (
                          <span className="caret" />
                        )}
                      </pre>
                    </div>
                  </div>
                </TraceBlock>
              )}

              {/* § 05 Critique */}
              {step >= 4 && (
                <TraceBlock
                  num={5}
                  title="Critique · 6 checks"
                  sub="Haiku 4.5 structured output · revision triggered only on failure"
                  active={step === 4}
                >
                  <div className="card" style={{ padding: "20px 22px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                        rowGap: 4,
                      }}
                    >
                      {allChecks.slice(0, revealedChecks).map((k, i) => (
                        <div
                          key={k}
                          className="fade-up"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 0",
                          }}
                        >
                          <Icon
                            name="check"
                            size={13}
                            stroke={2}
                            style={{ color: "var(--good)" }}
                          />
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: "var(--ink-2)" }}
                          >
                            {k.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                    {revealedChecks >= allChecks.length && (
                      <div
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: "1px dashed var(--hairline)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted)" }}
                        >
                          All checks passed · no revision needed
                        </span>
                        <Pill tone="good" dot>
                          passes
                        </Pill>
                      </div>
                    )}
                  </div>
                </TraceBlock>
              )}

              {/* End of trace */}
              {animMode === "done" && (
                <div
                  className="card fade-up"
                  style={{
                    padding: 28,
                    background: "var(--ink)",
                    color: "var(--paper)",
                    borderColor: "var(--ink)",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      opacity: 0.6,
                    }}
                  >
                    End of trace
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      marginTop: 14,
                      gap: 20,
                    }}
                  >
                    <div>
                      <h3
                        className="display"
                        style={{ fontSize: 32, letterSpacing: "-0.02em" }}
                      >
                        {latestEmail?.status === "sent"
                          ? "Sent."
                          : latestEmail?.status === "queued"
                            ? "Queued to send."
                            : "Draft complete."}
                      </h3>
                      <p
                        style={{
                          fontSize: 14,
                          opacity: 0.75,
                          marginTop: 8,
                          maxWidth: 480,
                        }}
                      >
                        {latestEmail?.status === "sent"
                          ? "If the lead replies, the classifier reads it and either pauses the follow-up or escalates to your inbox."
                          : "Will send at the next pacing slot, subject to daily quota."}
                      </p>
                    </div>
                    <Link href="/dashboard/inbox">
                      <button className="btn btn-accent" style={{ gap: 8 }}>
                        See replies
                        <Icon name="arrow-right" size={15} />
                      </button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
