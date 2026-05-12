import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { suppressionList } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Pill, SectionLabel, Stat } from "@/components/ui/design";
import { removeFromSuppression } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppressionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const rows = await db
    .select()
    .from(suppressionList)
    .where(eq(suppressionList.userId, userId))
    .orderBy(desc(suppressionList.createdAt))
    .limit(500);

  const byReason = (r: string) => rows.filter((x) => x.reason === r).length;
  const viaUnsubscribe = byReason("unsubscribe");
  const viaKillWord = byReason("kill_word");
  const viaManual = byReason("manual");

  return (
    <div>
      {/* Page header */}
      <header className="page-head">
        <div className="section-num" style={{ color: "var(--accent)" }}>
          § 07 — Suppression
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
          Do-not-contact list.
        </h1>
        <p
          style={{
            marginTop: 14,
            fontSize: 15,
            color: "var(--muted)",
            maxWidth: 560,
          }}
        >
          Once an address opts out — manually, via unsubscribe link, or via hard
          kill-word — it&apos;s blocked everywhere, forever.
        </p>
      </header>

      <div className="page-body">
        {/* Stat strip */}
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
          <Stat label="Total suppressed" value={rows.length} />
          <Stat label="Via unsubscribe" value={viaUnsubscribe} />
          <Stat label="Hard kill-word" value={viaKillWord} />
          <Stat label="Manual" value={viaManual} noBorderRight />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <SectionLabel>Suppressed addresses</SectionLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm">+ Add address</button>
            <button className="btn btn-ghost btn-sm">Import CSV</button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div
            className="card"
            style={{ padding: "48px 40px", textAlign: "center" }}
          >
            <div className="display" style={{ fontSize: 28, marginBottom: 10 }}>
              No suppressed addresses
            </div>
            <p style={{ color: "var(--muted)", fontSize: 15 }}>
              Addresses land here automatically when someone unsubscribes, replies
              with a kill-word, or you add them manually.
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1fr 80px",
                padding: "10px 18px",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--paper-2)",
              }}
            >
              {["Email", "Reason", "Added", ""].map((h) => (
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

            {rows.map((r, i) => {
              const reasonTone =
                r.reason === "unsubscribe"
                  ? "default"
                  : r.reason === "kill_word"
                    ? "bad"
                    : "default";
              return (
                <div
                  key={r.email}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 80px",
                    padding: "14px 18px",
                    borderBottom:
                      i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span className="mono" style={{ fontSize: 13 }}>
                    {r.email}
                  </span>
                  <Pill tone={reasonTone as "default" | "bad"}>
                    {r.reason.replace("_", " ")}
                  </Pill>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    {new Date(r.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <form action={removeFromSuppression}>
                    <input type="hidden" name="email" value={r.email} />
                    <button
                      type="submit"
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--bad)",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      remove
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          Suppression is applied cross-campaign at send time. Adding an address
          here blocks it from all future campaigns.
        </div>
      </div>
    </div>
  );
}
