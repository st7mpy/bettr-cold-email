# Phase 7 · Privacy Policy + Google OAuth Verification + Supabase RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock any Google account from signing in by publishing the app and passing Google's OAuth verification, plus seal the Supabase RLS security gap.

**Architecture:** Three independent workstreams — (1) enable Supabase RLS on all 10 tables via raw SQL (no app code changes needed), (2) build a minimal privacy policy page in the existing Next.js app matching the Dossier design system, (3) manual Google Cloud Console checklist to move the OAuth consent screen from Testing → Production and submit for verification.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind v4 design tokens, Supabase SQL editor, Google Cloud Console

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/app/privacy/page.tsx` | Privacy policy page — public, no auth required |
| Run SQL | Supabase SQL editor | Enable RLS on all 10 public tables |
| Manual | Google Cloud Console | Publish OAuth consent + submit verification |

---

## Task 1 · Enable Row-Level Security on all Supabase tables

**Why this is safe:** The app connects to Supabase via Drizzle using `DATABASE_URL` (the pooler connection string). That connection authenticates as the `postgres` superuser role, which bypasses RLS entirely — so enabling RLS on tables does not break any existing queries. It only closes the gap where someone with the Supabase anon key could hit PostgREST and read all data.

**Files:** No app files change. SQL runs in Supabase dashboard only.

- [ ] **Step 1: Open Supabase SQL editor**

Go to [supabase.com](https://supabase.com) → select project `jygtaqweqtulbqofjght` → left sidebar → **SQL Editor** → **New query**

- [ ] **Step 2: Paste and run the RLS enablement SQL**

```sql
-- Enable RLS on all public tables.
-- App connects as postgres (superuser) which bypasses RLS,
-- so no policies are needed — this just closes the anon-key gap.
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_research   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_research      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list   ENABLE ROW LEVEL SECURITY;
```

Click **Run** (or Ctrl+Enter). Expected output: `Success. No rows returned.`

- [ ] **Step 3: Verify the warning is gone**

In Supabase dashboard → **Database** → **Tables** — each table should now show a lock icon or "RLS enabled". The security advisor email warning about `rls_disabled_in_public` should not appear on the next check.

- [ ] **Step 4: Smoke-test the live app**

Visit `https://bettr-cold-email.vercel.app/dashboard`. Log in, navigate to Campaigns and Settings. If data loads normally, RLS has not broken anything. ✓

---

## Task 2 · Privacy policy page

**Files:**
- Create: `src/app/privacy/page.tsx`

The page must be publicly accessible (no auth), match the Dossier design system (same inline-style + CSS variable pattern as `src/app/page.tsx`), and satisfy Google's OAuth verification requirements: must name the app, list scopes used, explain data use, and provide a contact email.

- [ ] **Step 1: Create the file**

Create `src/app/privacy/page.tsx` with the following content:

```tsx
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

        {/* Sections */}
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
        ].map((section, i) => (
          <section
            key={i}
            style={{
              marginBottom: 48,
              paddingBottom: 48,
              borderBottom: "1px solid var(--hairline)",
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
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                    dangerouslySetInnerHTML={{
                      __html: item
                        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--ink)">$1</strong>')
                        .replace(/`(.+?)`/g, '<code class="mono" style="font-size:13px;color:var(--accent)">$1</code>'),
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
```

- [ ] **Step 2: Verify the page builds**

```bash
cd C:\Users\kotec\projects\relay
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "feat: add privacy policy page for Google OAuth verification"
```

- [ ] **Step 4: Push to trigger Vercel deploy**

```bash
git push
```

Wait ~60 seconds, then visit `https://bettr-cold-email.vercel.app/privacy` to confirm the page is live and publicly accessible (no login required).

---

## Task 3 · Google OAuth consent screen — publish + submit for verification

This is a manual checklist. No code changes required.

- [ ] **Step 1: Open Google Cloud Console**

Go to [console.cloud.google.com](https://console.cloud.google.com) → select the project that owns the `GOOGLE_OAUTH_CLIENT_ID` in your Vercel env vars.

- [ ] **Step 2: Navigate to OAuth consent screen**

Left sidebar → **APIs & Services** → **OAuth consent screen**

- [ ] **Step 3: Fill in required fields** (if not already set)

| Field | Value |
|---|---|
| App name | Bettr Cold Email |
| User support email | siddharth77work@gmail.com |
| App homepage | `https://bettr-cold-email.vercel.app` |
| Privacy policy URL | `https://bettr-cold-email.vercel.app/privacy` |
| Authorized domain | `bettr-cold-email.vercel.app` |
| Developer contact email | siddharth77work@gmail.com |

Save changes.

- [ ] **Step 4: Add scopes** (if not already listed)

Click **Add or remove scopes**. Confirm these two are listed:
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`

Save.

- [ ] **Step 5: Publish the app**

Under **Publishing status** → click **Publish App** → confirm the dialog.

Status should now show **In production** (not **Testing**).

After publishing, *any* Google account can sign in without being added as a test user. However, since the scopes are sensitive, Google will display a warning screen ("This app hasn't been verified") until verification completes — users can still click through.

- [ ] **Step 6: Submit for verification**

Click **Prepare for verification** (or **Submit for verification** if visible).

Provide:
- **Justification for `gmail.send`:** "Users connect their Gmail account to send personalised cold email sequences through our platform. We send on their behalf only to leads they upload."
- **Justification for `gmail.modify`:** "We read thread IDs of replies to detect when a prospect responds, so we can stop the sequence automatically. We mark those threads as read after processing."
- **Demo video or instructions:** Describe the flow — sign up → connect Gmail → create campaign → launch. A Loom video of the flow is strongly recommended by Google for sensitive scopes.

Submit. Google review takes **1–7 business days** for sensitive scopes.

- [ ] **Step 7: Remove yourself as test user** (optional cleanup)

Once published, the test-user list is irrelevant. You can remove `siddharth77work@gmail.com` from the test users list under **Test users** tab, or leave it — it has no effect once in production.

---

## Self-review

**Spec coverage check:**
- [x] RLS enabled on all 10 tables → Task 1
- [x] Privacy policy page live at `/privacy` → Task 2
- [x] Google OAuth consent screen published + verification submitted → Task 3
- [x] Privacy policy URL satisfies Google's requirement → Task 2 Step 4 + Task 3 Step 3

**No placeholders:** All SQL, TSX code, and form field values are complete and literal.

**Type consistency:** `PrivacyPage` is a default export server component with no props — no type mismatches possible.
