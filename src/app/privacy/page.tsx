export const metadata = {
  title: "Privacy Policy · Bettr Cold Email",
};

const LAST_UPDATED = "May 16, 2026";
const CONTACT = "siddharth77work@gmail.com";
const APP_URL = "https://bettr-cold-email.vercel.app";

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        position: "relative",
        zIndex: 2,
      }}
    >
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
        <a
          href="/"
          className="display"
          style={{ fontSize: 20, textDecoration: "none", color: "var(--ink)" }}
        >
          Bettr Cold Email
        </a>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".1em" }}
        >
          PRIVACY POLICY
        </span>
      </nav>

      {/* Content */}
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "64px 32px 96px",
        }}
      >
        {/* Header */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 16,
          }}
        >
          Legal
        </div>
        <h1
          className="display"
          style={{ fontSize: 48, lineHeight: 1.05, marginBottom: 12 }}
        >
          Privacy Policy
        </h1>
        <p
          className="mono"
          style={{ fontSize: 12, color: "var(--muted)", marginBottom: 56 }}
        >
          Last updated: {LAST_UPDATED}
        </p>

        {[
          {
            title: "What we are",
            body: `Bettr Cold Email (operated at ${APP_URL}) is an AI-powered cold email tool. It researches your leads, drafts personalised emails, sends them through your connected Gmail account, and monitors replies so sequences stop automatically when someone responds.`,
          },
          {
            title: "Data we collect",
            body: null,
            list: [
              "**Account data** — your name and email address from Google sign-in (via Clerk).",
              "**Lead data** — names, email addresses, company names, and any notes you upload via CSV.",
              "**Gmail access** — OAuth access and refresh tokens, stored AES-256-GCM encrypted. Used only to send email and read replies on your behalf. We never store the content of emails in your inbox beyond what is needed to detect replies to sequences you started.",
              "**Usage data** — counts of emails sent, API calls made, and reply classifications. Used to enforce plan limits and display your dashboard stats.",
              "**Postal address** — collected once during onboarding and added to email footers as required by the CAN-SPAM Act.",
            ],
          },
          {
            title: "Google API scopes we request",
            body: null,
            list: [
              "`gmail.send` — to send emails on your behalf.",
              "`gmail.modify` — to read thread IDs for reply detection and to mark threads as read when processing them.",
            ],
            note: "We do not read, store, or process any Gmail messages other than replies to sequences you have started through this app. Our use of Google API data complies with the Google API Services User Data Policy, including the Limited Use requirements.",
          },
          {
            title: "How we use your data",
            body: null,
            list: [
              "Sending cold email sequences you configure and launch.",
              "Detecting replies so sequences stop when a lead responds.",
              "Displaying campaign analytics and usage statistics on your dashboard.",
              "Enforcing your plan's daily and monthly email limits.",
            ],
          },
          {
            title: "Third-party services",
            body: null,
            list: [
              "**Anthropic** — lead research summaries and email drafts are generated using Claude (Opus and Haiku models). Lead data (name, company, role) is sent to the Anthropic API for this purpose.",
              "**Tavily** — web search queries including the lead's name and company are sent to Tavily to gather public research signals.",
              "**Clerk** — handles authentication. See clerk.com/privacy.",
              "**Supabase** — hosts the database. Data is stored in the EU (Frankfurt) region.",
              "**Vercel** — hosts the application. See vercel.com/legal/privacy-policy.",
            ],
          },
          {
            title: "Data we do not sell or share",
            body: "We do not sell, rent, or share your personal data or your leads' data with any third party for marketing purposes. The only sharing is to the service providers listed above, strictly to operate the product.",
          },
          {
            title: "Data retention",
            body: "Your data is retained for as long as your account is active. If you delete your account, all your data — including leads, emails, and connected Gmail tokens — is deleted from our database within 30 days. Research cache entries (company signals) may persist up to 7 days as they are shared across users and contain only publicly-sourced information.",
          },
          {
            title: "Your rights",
            body: null,
            list: [
              "**Access** — you can view all your data on the dashboard.",
              "**Deletion** — delete your account from the Settings page to remove all personal data.",
              "**Revoke Gmail access** — disconnect your Gmail account from Settings at any time. This immediately invalidates the stored OAuth tokens.",
              "**GDPR / CCPA** — if you are in the EU or California and need a data export or erasure request, email us at the address below.",
            ],
          },
          {
            title: "Security",
            body: "Gmail OAuth tokens are encrypted at rest using AES-256-GCM with a 32-byte key stored as an environment variable. All data is transmitted over TLS. We do not log email body content beyond what appears in your dashboard.",
          },
          {
            title: "Contact",
            body: `Questions, data requests, or concerns: ${CONTACT}`,
          },
        ].map((section, i, arr) => (
          <section
            key={i}
            style={{
              marginBottom: 48,
              paddingBottom: 48,
              borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <h2
              className="display"
              style={{ fontSize: 22, marginBottom: 16 }}
            >
              {section.title}
            </h2>
            {section.body && (
              <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.7 }}>
                {section.body}
              </p>
            )}
            {section.list && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {section.list.map((item, j) => (
                  <li
                    key={j}
                    style={{
                      fontSize: 15,
                      color: "var(--ink-2)",
                      lineHeight: 1.65,
                      paddingLeft: 20,
                      borderLeft: "2px solid var(--hairline)",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: item
                        .replace(
                          /\*\*(.+?)\*\*/g,
                          '<strong style="color:var(--ink)">$1</strong>'
                        )
                        .replace(
                          /`(.+?)`/g,
                          '<code class="mono" style="font-size:13px;color:var(--accent)">$1</code>'
                        ),
                    }}
                  />
                ))}
              </ul>
            )}
            {section.note && (
              <p
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "var(--paper-2)",
                  borderRadius: "var(--radius)",
                }}
              >
                {section.note}
              </p>
            )}
          </section>
        ))}
      </main>
    </div>
  );
}
