# Relay — AI Cold Email Agent (GTM Tool)

**Status:** design approved, ready for implementation planning
**Date:** 2026-05-05
**Working name:** `relay` (placeholder — change anytime)

---

## 1. What we're building

Relay is a multi-tenant SaaS web app where a user (1) connects their Gmail or Outlook account, (2) uploads a CSV of leads, (3) describes who they are and what they want, and (4) launches a sequence. Per lead, the agent researches the recipient on the public web, drafts a personalized email grounded in cited facts, sends it from the user's connected inbox, classifies replies, and follows up or stops based on classification.

**Target users:** sales teams running outbound, individuals doing job-hunting outreach, founders pitching for partnerships or investment. The product is the same for all three — the difference is just the user's prompt.

**Non-goals (explicit):** LinkedIn scraping, mass blast tools, cold-call dialers, autonomous multi-turn reply conversations. We are not a "spray and pray" tool.

## 2. MVP scope

**In:**
- Sign-up, Gmail/Outlook OAuth, single connected account per user
- CSV-only lead import (one file per campaign, ≤5,000 rows)
- Campaign wizard with sequence builder (1–5 steps, configurable delays)
- Per-lead agent pipeline: research → hook extraction → groundedness verification → draft → critique → optionally revise
- Send via Gmail API or Microsoft Graph; replies tracked via push subscriptions + 15-min poll fallback
- Reply classification (positive / negative / out_of_office / unsubscribe / question / unrelated) with hard kill-words bypass
- Open and click tracking via redirect/pixel
- Suppression list (cross-campaign, per user)
- Web search via Tavily; optional user-supplied Apollo/Hunter key for enrichment
- Compliance footer with unsubscribe link + `List-Unsubscribe` header + sender postal address

**Out (deferred or never):**

| Feature | When |
|---|---|
| HubSpot / CRM integrations | v1.1 |
| Draft-don't-send reply mode | v1.2 |
| A/B subject line testing | v1.5 |
| Team accounts / multi-seat | v1.5 |
| Custom SMTP / shared ESP | v2 |
| Autonomous multi-turn replies | v2 |
| Mobile app | never (responsive web only) |
| LinkedIn scraping/data | never (ToS) |
| Stripe billing live at launch | post-PMF (track usage now, paywall later) |

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js / TypeScript | Single language, full-stack |
| Framework | Next.js 15 (App Router) | UI + server actions + API routes in one repo |
| Hosting | Vercel | Native Next.js deploy, fits Inngest |
| Database | Postgres (Supabase or Neon) | Relational, mature, free tier |
| Auth | Clerk | Magic link + OAuth, minimal setup |
| Background jobs | Inngest | Native delayed steps + retries; perfect for sequences |
| LLM | Anthropic Claude API | Opus 4.7 for writing/revision, Haiku 4.5 for structured tasks |
| Web search | Tavily | Cheap, has full-page extract endpoint |
| File storage | Supabase Storage | CSV uploads |

**No separate worker service.** Inngest functions live in the Next.js repo until volume justifies a split.

## 4. Architecture

```
┌─ Next.js App (Vercel) ──────────────────────────────────┐
│   • UI: dashboard, campaign wizard, reply inbox          │
│   • Server actions: campaign CRUD, OAuth callbacks       │
│   • API routes: tracking pixels, OAuth webhooks          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐         ┌──────────────────┐
        │  Postgres      │◄────────┤  Inngest Workers │
        │  (Supabase)    │         │  • agent pipeline│
        │                │         │  • send scheduler│
        └────────────────┘         │  • reply poller  │
                                   │  • follow-up cron│
                                   └────────┬─────────┘
                                            │
                ┌───────────────────────────┼───────────────────────┐
                ▼                           ▼                       ▼
        ┌──────────────┐          ┌──────────────────┐    ┌─────────────────┐
        │ Claude API   │          │ Gmail API /      │    │ Tavily          │
        │ Opus 4.7 +   │          │ MS Graph         │    │ (search +       │
        │ Haiku 4.5    │          │                  │    │  full extract)  │
        └──────────────┘          └──────────────────┘    └─────────────────┘
```

**Data flow per lead, end to end:**
1. User uploads CSV → leads inserted with `status='pending'`
2. Inngest fans out one `process-lead` job per row
3. `process-lead` runs the agent pipeline (§6) → writes drafted email to `emails` with `status='queued'`
4. Send scheduler picks up queued emails respecting per-account quota and pacing → sends via Gmail/Graph
5. Tracking pixel/click hits update the row
6. Reply poller / push webhook → classifies reply → updates `leads.status` and either schedules a follow-up or stops

## 5. Data model

```sql
users
  id (Clerk uid), email, plan, postal_address, created_at

email_accounts
  id, user_id, provider ('gmail'|'outlook'),
  oauth_access_token, oauth_refresh_token, oauth_expires_at,
  daily_quota int, sent_today int, last_reset_at,
  watch_subscription_id, watch_expires_at,
  status ('active'|'expired'|'revoked')
  -- MVP: at most one row with status='active' per user_id (enforced in app layer
  -- and by partial unique index `(user_id) where status='active'`)

campaigns
  id, user_id, name, goal_text,
  sender_persona text, value_prop text,
  model_tier ('opus'|'sonnet'),
  status ('draft'|'launched'|'paused'|'completed'),
  created_at, launched_at

sequence_steps
  id, campaign_id, step_index,
  intent_prompt text,           -- freeform; the agent generates per lead
  delay_days int                -- delay from prior step

leads
  id, campaign_id, email, name, company, title,
  notes text,                   -- user-supplied context (highest-quality hook)
  custom_fields jsonb,          -- arbitrary CSV columns
  status enum,                  -- see state machine below
  created_at

company_research                -- shared across leads from same company
  company (key), funding_signals jsonb, news_signals jsonb,
  fetched_at, expires_at        -- 7-day TTL

lead_research
  lead_id (key), raw_search_results jsonb,
  fetched_pages jsonb,          -- full extract content
  hooks jsonb,                  -- typed hooks (see §6.2)
  fetched_at, expires_at        -- 30-day TTL

emails
  id, lead_id, campaign_id, step_index,
  subject, body, hook_used jsonb,
  provider_message_id, thread_id,
  sent_at, opened_at, clicked_at, replied_at, bounced_at,
  status ('queued'|'sent'|'bounced'|'failed'|'needs_review')

replies
  id, email_id, raw_body, from_address,
  classification enum, classification_confidence,
  summary, classified_at

suppression_list
  user_id, email, reason, created_at
  PRIMARY KEY (user_id, email)
```

**`leads.status` state machine:**

```
pending → researching → ready → sending → sent → (replied | stopped | bounced | completed)
                                              ↘ no_signal      (skip; surface to user)
                                              ↘ needs_review   (critique failed twice)
```

## 6. The agent pipeline

Each step is its own Inngest step — independently retryable, observable in the Inngest dashboard, with state persisted between steps in the DB.

### 6.1 Step 1 — Research (tiered query plan)

Replace the naive single search with a structured plan:

**Person-first queries** (run all, keep top hits per query):
- `"{name}" "{company}"` (exact-match co-occurrence)
- `"{name}" site:linkedin.com/in/`
- `"{name}" site:twitter.com OR site:x.com OR site:bsky.app`
- `"{name}" interview OR podcast OR talk OR keynote`
- `"{name}" blog OR essay OR wrote`

**Company-context queries** (fallback, also used to refresh `company_research`):
- `"{company}" funding OR raised OR announced` (last 6mo)
- `"{company}" launched OR shipped OR released`
- `"{company}" hiring "{role-relevant-team}"`

**Then fetch full content** via Tavily `extract` for the top 2-3 person-relevant URLs. Snippets alone are insufficient. Cost is negligible (~$0.001/lead).

Output: `lead_research.raw_search_results` and `lead_research.fetched_pages`.

### 6.2 Step 2 — Extract hooks (typed, scored objectively)

LLM: Haiku 4.5 with structured output.
Input: search results + fetched page text.
Output:

```json
{
  "hooks": [
    {
      "type": "person_hook" | "company_hook",
      "source_url": "...",
      "fact": "≤25 words, paraphrased",
      "quoted_phrase": "verbatim if direct quote, else null",
      "why_relevant": "1 sentence",
      "recency_days": 12
    }
  ]
}
```

**Specificity score** is computed in code (not asked of the LLM — self-reported scores are unreliable):

| Criterion | Points |
|---|---|
| Contains a concrete date | +1 |
| Contains a `quoted_phrase` | +1 |
| References a specific named project/product/event | +1 |
| Contains a non-year number | +1 |

**Eligibility gate: `specificity_score >= 2`.**

**Hard-target escalation:** if no hook reaches score ≥ 2 with Haiku, re-run Step 2 once with **Opus 4.7** on the full fetched content. Spend the extra compute where it matters.

### 6.3 Step 2.5 — Groundedness verification

For each eligible hook, a separate Haiku call:
- Input: `(fact, full text of the cited page)`
- Output: `{ supported: bool, evidence_quote: string }`

Drop hooks where `supported == false`. This catches the most damaging failure mode — confidently wrong claims about the recipient.

### 6.4 Step 3 — Draft (Opus 4.7)

LLM: Opus 4.7. Hook selection priority:
1. User-supplied `lead.notes` (highest-quality hook of all)
2. `person_hook` with specificity ≥ 3
3. `person_hook` with specificity 2
4. `company_hook` with specificity ≥ 3
5. **No-hook branch:** generate a deliberately short, no-claim email (5-7 sentences). No fake personalization. Subject and opener generic but well-written. Mark `emails.hook_used = null`.

Hard rule in prompt: every personalization claim must reference a `source_url` from the supplied hooks. No inventing facts.

Output: `{ subject, body, hook_used }`.

### 6.5 Step 4 — Critique (Haiku 4.5)

Structured-output check on every draft:

```json
{
  "passes": bool,
  "checks": {
    "length_ok":            bool,  // ≤150 words
    "specific":             bool,  // not generic boilerplate
    "human_tone":           bool,  // doesn't read as AI
    "claim_grounded":       bool,  // every fact ties back to a hook
    "not_creepy":           bool,  // no "I noticed you live at..."
    "subject_not_clickbait":bool
  },
  "failures": ["check_id", ...],
  "suggestions": "1-2 sentences"
}
```

### 6.6 Step 5 — Revise (Opus 4.7)

Runs only if Step 4 fails. Input: original draft + critique notes. **One revision attempt.** If the revised version still fails critique → mark `emails.status = 'needs_review'`, do not send. Surface in user's reply inbox.

### 6.7 Cost envelope

| Path | Models invoked | Approx cost |
|---|---|---|
| Easy lead, passes first time | Haiku ×3 + Opus ×1 | ~$0.06 |
| Hard target, escalation | Haiku ×3 + Opus ×2 | ~$0.10 |
| Follow-up email | Haiku ×1 + Opus ×1 (skip research) | ~$0.04 |

Per-user monthly cap configurable; default 1,000 emails/mo on free tier.

## 7. Sending and reply tracking

### 7.1 Sending mechanics

- **Gmail:** `users.messages.send` on the user's OAuth token. Replies thread naturally back to the user's inbox (no reply-to redirection — the simpler model).
- **Outlook:** Microsoft Graph `/me/sendMail`. Same shape.
- **Throttling:** stored on `email_accounts.daily_quota`. Defaults: Gmail free 350/day, Workspace 1500/day, Outlook 1000/day. New connections start at 50/day for the first 7 days, ramp gradually.
- **Pacing:** randomized 30–120s gaps between sends per account. No bulk-blast cadence.
- **Quota-exceeded handling:** Inngest reschedules the job for the next morning (account's local timezone if known, else UTC).

### 7.2 Tracking

- **Open pixel:** 1×1 image at `/api/track/open/[email_id]` → updates `emails.opened_at`. Surfaced in UI as "indicative open" (Apple Mail Privacy Protection inflates this metric).
- **Click tracking:** wrap each user-supplied URL as `/api/track/click/[email_id]?to=<encoded>` → 302 redirect, sets `clicked_at`.
- **Unsubscribe:** mandatory `/api/unsubscribe/[email_id]` link in footer + `List-Unsubscribe` header. On hit, append to `suppression_list` and stop the sequence.

### 7.3 Reply detection

- **Gmail:** `users.watch` push subscription on the user's mailbox → Pub/Sub topic → webhook handler. Subscriptions expire after 7 days; daily Inngest cron renews.
- **Outlook:** Graph webhook subscriptions on `/me/messages`. Similar renewal.
- **Fallback poll:** every 15 min, list new messages since last cursor, match `In-Reply-To` / thread ID against `emails.provider_message_id`.
- **Bounce detection:** parse incoming `mailer-daemon` envelopes with matching In-Reply-To → mark `emails.status = 'bounced'`, add to suppression.

### 7.4 Reply classification

When a reply lands:

1. Haiku 4.5 structured-output call: `(reply_body, original_email_body) → { classification, confidence, summary }`.
2. **Hard kill-word bypass before LLM:** if the reply body contains any of `unsubscribe`, `remove me`, `stop emailing`, `take me off`, `do not contact` (case-insensitive) → automatic suppression. The LLM doesn't get a chance to be wrong here.
3. **Low-confidence escalation:** if Haiku confidence < 0.85, re-classify with Opus.
4. Action by classification:

| Classification | Action |
|---|---|
| `positive` | Stop sequence; mark `lead.status = 'replied'`; surface in inbox with high priority |
| `negative` | Stop sequence; mark `lead.status = 'stopped'`; do **not** add to suppression (they may be a future opportunity) |
| `unsubscribe` | Add to suppression; stop sequence |
| `out_of_office` | Pause sequence; resume in 7 days |
| `question` | Stop automated sequence; flag for user response (the v1.2 "draft don't send" feature lives here) |
| `unrelated` | Sequence keeps running |

### 7.5 Sequence scheduler

For each lead, the campaign launches as one Inngest function chaining N steps with `step.sleep(delay_days)` between them.

On each step fire:
1. Re-check `lead.status`. If `replied`/`stopped`/`bounced`/`unsubscribe`/`needs_review` → abort.
2. Check suppression list. If listed → abort.
3. Run agent pipeline, **but skip Step 1–2** for follow-ups (research already cached in `lead_research`). Steps 3–5 generate the new email aware of the prior thread.
4. Enqueue for sending.

## 8. User-facing flows

### 8.1 Onboarding

- Sign up via Clerk (email + magic link)
- Connect Gmail or Outlook (OAuth) — gated; no campaigns possible until done
- Profile form: name, role, company, postal address (CAN-SPAM), what you typically reach out about → seeds `users.postal_address` and default `sender_persona` / `value_prop`

### 8.2 Create campaign (5-step wizard)

1. **Name + goal** — e.g. "hiring outreach", "partnership pitch"
2. **Upload CSV** — column-mapping wizard. Required: email. Recommended: name, company, title. Everything else flows into `custom_fields`. Hard cap 5,000 rows.
3. **Persona + value prop** — pre-filled from onboarding, editable per campaign
4. **Sequence builder** — 1–5 steps, each with a freeform `intent_prompt` and `delay_days`. Not mail-merge templates — the user describes intent in natural language; the agent writes each email fresh.
5. **Review** — show 3 sample emails generated against 3 random rows of the upload before launch. **This step is non-skippable** — users must trust the output before paying with their inbox reputation.

### 8.3 Campaign dashboard

- Per-campaign: total leads, status breakdown, reply rate, send progress bar
- Lead table with status filter; clicking a lead reveals the full agent trace: research hooks, draft, critique scores, sent email. Full transparency builds trust.

### 8.4 Reply inbox

- Cross-campaign view of replies needing attention (default filter: `positive` + `question`)
- Each row: original email sent, the reply, classification + summary, deep-link to compose response in user's Gmail/Outlook

### 8.5 Settings

- Connected email accounts (revoke / reconnect)
- Suppression list (CSV import + manual add)
- Per-user usage cap and current month spend
- Account / billing (post-PMF; placeholder UI in MVP)

## 9. Compliance

- **CAN-SPAM (US):** every email gets unsubscribe link + `List-Unsubscribe` header + sender's postal address in the footer. Subject lines checked by the critique step for deception. Mandatory.
- **GDPR (EU):** B2B legitimate-interest defensible but contested. MVP shows a clear notice on launch: "By launching, you confirm your outreach has a lawful basis." Deletion of personal data on request via suppression list endpoint.
- **CASL (Canada):** stricter. Same notice approach for v1; geo-aware blocking is v1.1.
- **Suppression list is global per user** — once an address opts out, it's blocked across all that user's campaigns.
- **Hard kill-words bypass** any LLM classification (see §7.4) — there's no acceptable margin for getting an opt-out wrong.

## 10. Testing strategy

- **Unit tests:**
  - Hook extraction (golden fixtures → expected structured output)
  - Specificity scoring (boundary cases)
  - Reply classification (~100 labeled-reply fixture corpus)
  - Suppression matching (case/whitespace edge cases)
  - CSV column-mapping (malformed inputs)
- **Integration tests:**
  - OAuth flows (mocked Gmail/Outlook)
  - Inngest pipeline end-to-end with mocked LLM + mocked send
  - Webhook signature verification
- **Eval harness:**
  - Holdout set of ~50 (lead, persona) pairs → LLM-as-judge scores email on `personalization`, `tone`, `length`, `groundedness`. Run on every prompt change. Regression-gate prompt changes on this score.
- **Manual smoke test before each release:** real campaign of 5 leads against a personal Gmail. The "would I send this?" check is irreplaceable.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Google OAuth verification** — `gmail.send` + `gmail.modify` are restricted scopes. >100 users triggers CASA security audit (~$15-30k). | Stay <100 users until PMF signal. Budget audit before scaling marketing. Same for Microsoft at higher volume. |
| **Hallucinated fact about a recipient** | Step 3 prompt rule (claims must cite a hook) + Step 2.5 groundedness verification + Step 4 critique. |
| **Reply misclassification continuing to spam a "no"** | Hard kill-words bypass (§7.4). Confidence-gated Opus escalation for low-confidence replies. |
| **Spam-filter blacklisting of new accounts** | 50/day for first 7 days on a new connection; ramp gradually. Warn users not to connect a brand-new email address. |
| **LLM cost runaway** | Per-user monthly cap (default 1,000 emails). Live spend in settings. Hard-target escalation gated. |
| **CSV-of-doom** | 5,000 row hard cap, validated client and server side. |
| **Inngest job storms during CSV import** | Per-user concurrency throttle of 5 leads in research at once. Research isn't time-critical. |
| **Sender hits Gmail daily quota mid-sequence** | Reschedule to next morning, don't fail. Show projected completion date in dashboard. |
| **Tavily rate-limit / outage** | Per-user request budget; fall back to SerpAPI if configured; otherwise mark lead `no_signal` and continue. |

## 12. Open questions (deliberately deferred)

- **Multi-language email support.** MVP English only.
- **Custom domain for tracking pixel** for better deliverability. Punted to v1.5 (needs DNS UX).
- **Stripe billing live at launch vs post-PMF.** Defaulting to post-PMF (track usage, charge later). Reconsider if early users are willing to pay before the product is fully baked.
- **Deep-research tier** using a true agentic tool-use loop (Approach 3 from brainstorming). Worth piloting once we see which campaigns chronically return `no_signal`.
