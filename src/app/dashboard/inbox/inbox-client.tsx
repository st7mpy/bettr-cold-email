"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill, StatusDot } from "@/components/ui/design";

type Classification =
  | "positive"
  | "question"
  | "negative"
  | "out_of_office"
  | "unsubscribe"
  | "unrelated";

interface ReplyRow {
  id: string;
  classification: string | null;
  classificationConfidence: number | null;
  summary: string | null;
  rawBody: string;
  receivedAt: Date | null;
  emailId: string;
  emailSubject: string;
  leadId: string;
  leadName: string | null;
  leadEmail: string;
  campaignId: string;
  campaignName: string;
}

interface Props {
  rows: ReplyRow[];
  initialFilter: string;
}

const FILTERS = [
  "actionable",
  "all",
  "positive",
  "question",
  "negative",
  "out_of_office",
  "unsubscribe",
] as const;

function classificationPill(c: string | null) {
  const map: Record<string, "good" | "warn" | "bad" | "default"> = {
    positive: "good",
    question: "warn",
    negative: "bad",
    out_of_office: "default",
    unsubscribe: "default",
    unrelated: "default",
  };
  return (map[c ?? ""] ?? "default") as "good" | "warn" | "bad" | "default";
}

function relativeTime(d: Date | null): string {
  if (!d) return "";
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function InboxClient({ rows, initialFilter }: Props) {
  const [filter, setFilter] = useState(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(
    rows[0]?.id ?? null
  );

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "actionable")
      return r.classification === "positive" || r.classification === "question";
    return r.classification === filter;
  });

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  // Count per filter
  const counts: Record<string, number> = {
    actionable: rows.filter(
      (r) => r.classification === "positive" || r.classification === "question"
    ).length,
    all: rows.length,
    positive: rows.filter((r) => r.classification === "positive").length,
    question: rows.filter((r) => r.classification === "question").length,
    negative: rows.filter((r) => r.classification === "negative").length,
    out_of_office: rows.filter((r) => r.classification === "out_of_office").length,
    unsubscribe: rows.filter((r) => r.classification === "unsubscribe").length,
  };

  return (
    <div>
      {/* Page header */}
      <header className="page-head">
        <div className="section-num" style={{ color: "var(--accent)" }}>
          § 06 — Reply inbox
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            marginTop: 10,
          }}
        >
          <h1
            className="display"
            style={{
              fontSize: 54,
              lineHeight: 1,
              letterSpacing: "-0.035em",
            }}
          >
            {counts.actionable} need attention.
          </h1>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setSelectedId(null);
              }}
              className="mono"
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 11.5,
                border: "1px solid var(--hairline)",
                background: filter === f ? "var(--ink)" : "var(--surface)",
                color: filter === f ? "var(--paper)" : "var(--muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "background 120ms, color 120ms",
                cursor: "pointer",
              }}
            >
              {f.replace("_", " ")}
              {counts[f] > 0 && (
                <span
                  style={{
                    background: filter === f ? "var(--paper)" : "var(--hairline)",
                    color: filter === f ? "var(--ink)" : "var(--muted)",
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 999,
                    fontWeight: 500,
                  }}
                >
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Split panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          height: "calc(100vh - 220px)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        {/* Left: reply list */}
        <div
          style={{
            borderRight: "1px solid var(--hairline)",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{ padding: "32px 24px", color: "var(--muted)", fontSize: 14 }}
              className="mono"
            >
              No replies in this view.
            </div>
          )}
          {filtered.map((r) => {
            const isSelected = selected?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--hairline)",
                  borderLeft: isSelected
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  background: isSelected ? "var(--paper-2)" : "transparent",
                  transition: "background 120ms",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--paper-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {r.leadName ?? r.leadEmail}
                    </span>
                    <Pill tone={classificationPill(r.classification)}>
                      {r.classification ?? "unclassified"}
                    </Pill>
                  </div>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}
                  >
                    {relativeTime(r.receivedAt)}
                  </span>
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}
                >
                  {r.campaignName}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-2)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.summary ?? r.rawBody.slice(0, 120)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: detail panel */}
        {selected ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
            }}
          >
            {/* Header band */}
            <div
              style={{
                padding: "20px 32px",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--paper-2)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  marginBottom: 8,
                }}
              >
                {selected.campaignName}
              </div>
              <div
                className="display"
                style={{ fontSize: 30, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                {selected.leadName ?? selected.leadEmail}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "var(--muted)",
                  marginTop: 4,
                }}
              >
                Re: {selected.emailSubject}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Pill tone={classificationPill(selected.classification)}>
                  {selected.classification ?? "unclassified"}
                </Pill>
                {selected.classificationConfidence != null && (
                  <Pill>
                    {selected.classificationConfidence}% confidence
                  </Pill>
                )}
              </div>
            </div>

            {/* Summary band */}
            {selected.summary && (
              <div
                style={{
                  padding: "16px 32px",
                  borderBottom: "1px solid var(--hairline)",
                  background: "color-mix(in oklch, var(--accent) 4%, var(--paper))",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    marginBottom: 6,
                  }}
                >
                  Summary · Haiku 4.5
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "var(--ink-2)",
                    lineHeight: 1.55,
                  }}
                >
                  {selected.summary}
                </div>
              </div>
            )}

            {/* Body */}
            <div style={{ padding: "24px 32px", flex: 1 }}>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--ink-2)",
                }}
              >
                {selected.rawBody}
              </pre>
            </div>

            {/* Footer toolbar */}
            <div
              style={{
                padding: "16px 32px",
                borderTop: "1px solid var(--hairline)",
                background: "var(--paper-2)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <a
                href={`mailto:${selected.leadEmail}`}
                className="btn btn-primary btn-sm"
              >
                Reply in Gmail
              </a>
              <button className="btn btn-outline btn-sm">Mark handled</button>
              <div style={{ flex: 1 }} />
              <Link
                href={`/dashboard/campaigns/${selected.campaignId}/leads/${selected.leadId}`}
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  letterSpacing: ".06em",
                }}
              >
                VIEW LEAD TRACE →
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
            className="mono"
          >
            Select a reply to read it
          </div>
        )}
      </div>
    </div>
  );
}
