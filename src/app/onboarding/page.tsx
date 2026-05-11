import { redirect } from "next/navigation";
import { saveOnboarding } from "./actions";
import { getCurrentUserRow } from "@/lib/auth";
import { Icon } from "@/components/ui/design";
import Link from "next/link";

export default async function OnboardingPage() {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (user.postalAddress) redirect("/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "0.9fr 1.1fr",
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Left editorial rail */}
      <div
        style={{
          background: "var(--paper-2)",
          borderRight: "1px solid var(--hairline)",
          padding: 48,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Link href="/" style={{ textAlign: "left", alignSelf: "start" }}>
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            ← Bettr Cold Email
          </span>
        </Link>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 440,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Setup
          </div>
          <h1
            className="display"
            style={{
              fontSize: 64,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              marginTop: 18,
            }}
          >
            Tell the agent
            <br />
            who you <em>are</em>.
          </h1>
          <p
            style={{
              marginTop: 24,
              fontSize: 16,
              color: "var(--ink-2)",
              lineHeight: 1.55,
            }}
          >
            US law (CAN-SPAM) requires your postal address in the footer of every
            email you send. This is shown to recipients only and never shared.
          </p>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, marginTop: 36 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  height: 3,
                  width: i === 1 ? 56 : 28,
                  background: i <= 1 ? "var(--ink)" : "var(--hairline)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--muted)" }}
        >
          Connect Gmail first — settings will redirect here if no account is
          linked.
        </div>
      </div>

      {/* Right form pane */}
      <div
        style={{
          padding: "56px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: 520 }} className="fade-up">
          {/* § 01 — Connect inbox */}
          <div style={{ marginBottom: 36 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
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
                § 01
              </span>
              <h2
                className="display"
                style={{ fontSize: 26, letterSpacing: "-0.02em" }}
              >
                Connect inbox
              </h2>
              <span
                style={{ flex: 1, height: 1, background: "var(--hairline)" }}
              />
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
              <a
                href="/api/oauth/google/start"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "20px 22px",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent-line)",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "all 150ms",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 6,
                    background: "var(--paper-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="google" size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>
                    Google · Gmail
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}
                  >
                    Workspace and personal · 350–1500/day
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: ".04em",
                  }}
                >
                  Recommended
                </div>
              </a>

              {/* OAuth permissions note */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "var(--paper-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: "var(--muted)",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  What we ask for
                </div>
                <ul
                  style={{
                    fontSize: 13,
                    color: "var(--ink-2)",
                    lineHeight: 1.7,
                    paddingLeft: 18,
                    margin: 0,
                  }}
                >
                  <li>
                    <code className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                      gmail.send
                    </code>{" "}
                    — to send drafts from your account
                  </li>
                  <li>
                    <code className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                      gmail.modify
                    </code>{" "}
                    — to read replies and thread state
                  </li>
                  <li>No mailbox archival. No third-party sharing. Revoke anytime.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* § 02 — Postal address */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
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
                § 02
              </span>
              <h2
                className="display"
                style={{ fontSize: 26, letterSpacing: "-0.02em" }}
              >
                Postal address
              </h2>
              <span
                style={{ flex: 1, height: 1, background: "var(--hairline)" }}
              />
            </div>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--muted)",
                marginBottom: 18,
              }}
            >
              Required by CAN-SPAM. Included in the footer of every email you
              send.
            </p>

            <form action={saveOnboarding} style={{ display: "grid", gap: 14 }}>
              <div>
                <label className="label" htmlFor="postalAddress">
                  Postal address
                </label>
                <input
                  className="input"
                  id="postalAddress"
                  name="postalAddress"
                  placeholder="123 Main St, San Francisco, CA 94102"
                  required
                  minLength={10}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ gap: 8 }}
                >
                  Continue
                  <Icon name="arrow-right" size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
