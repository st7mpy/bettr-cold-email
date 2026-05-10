# Bettr Cold Email — Phase 4: Send + track + reply detection

**Goal:** Queued emails (Phase 3 output) actually go out via Gmail. Opens, clicks, replies, and bounces are recorded. Replies are auto-classified and acted on (stop / pause / suppress).

**Stack additions:** none. Reuses Inngest, Gmail API, Claude Haiku, existing crypto.

---

## Tasks

1. **Send scheduler (Inngest)** — `email/send` event consumer. Reads `emails` rows where `status='queued'`, refreshes the access token, calls `sendGmailMessage`, marks `sent`. Per-account concurrency 1; randomized 30–120s gap; aborts if `sent_today >= daily_quota`. Reschedules to next morning on quota hit.

2. **Quota model** — `email_accounts.daily_quota` ramps up over the first 7 days (50 → 150 → 350 default) to avoid spam-filter blacklisting on a fresh connection. Daily reset cron resets `sent_today` at 00:00 in the user's timezone (default UTC).

3. **Tracking pixel** — `/api/track/open/[emailId]` returns a 1×1 transparent GIF and stamps `emails.opened_at`. Surfaced in UI as "indicative open" (Apple MPP caveat).

4. **Click wrapping** — drafter post-processor wraps any URLs in the email body as `/api/track/click/[emailId]?to=<base64url>`. The redirect endpoint stamps `clicked_at` then 302s to the original URL.

5. **Unsubscribe** — `/api/unsubscribe/[emailId]` (GET to confirm, POST to commit) appends to `suppression_list`, marks lead `stopped`. Mandatory `List-Unsubscribe` header on every send. Server-side suppression check before any send (defense in depth).

6. **Reply detection — Gmail watch** — `users.watch` subscription per account, Pub/Sub topic, webhook handler at `/api/gmail/push`. On notification, fetch new history, match `In-Reply-To` to `emails.providerMessageId`. Daily cron re-issues subscriptions before the 7-day expiry.

7. **Reply detection fallback** — 15-min Inngest cron lists messages newer than `last_history_id` for any account whose watch is missing/expired. Catches edge cases without a dedicated webhook.

8. **Reply classification** — Haiku structured-output: `{ classification, confidence, summary }`. Hard kill-words bypass the LLM (`unsubscribe`, `remove me`, `stop emailing`, `take me off`, `do not contact`) — case-insensitive, language-aware where reasonable. Confidence < 0.85 → re-classify with Opus.

9. **Action by classification** —
   - `positive` / `negative` → stop sequence, mark lead, surface in inbox
   - `unsubscribe` → suppression list + stop
   - `out_of_office` → pause sequence 7 days
   - `question` → stop sequence, flag for human (Phase 5 ships the "draft don't send" assist)
   - `unrelated` → keep running

10. **Bounce handling** — parse `mailer-daemon` envelopes with matching `In-Reply-To` → `emails.status='bounced'`, lead `bounced`, append to suppression.

11. **Reply inbox UI** — `/dashboard/inbox`. Cross-campaign view filtered to `positive` + `question` by default. Each row: original email, the reply, classification + summary, deep-link to the user's Gmail thread.

12. **Sequence follow-ups** — when `sequence_steps[step+1]` exists and lead is still active after `delay_days`, fan out a `lead/process` event with the new `stepIndex`. The pipeline reuses cached `lead_research` (skips steps 1-2), runs draft/critique/revise on the new step's `intentPrompt`. Sends through the same scheduler.

---

## Pre-flight you'll need

- **Google Cloud Pub/Sub topic** for the Gmail watch (`projects/<project>/topics/gmail-watch`) + service account with `pubsub.publisher` for Gmail's service account, `pubsub.subscriber` for our app
- **Public webhook URL** for Pub/Sub push subscription (ngrok in dev, Vercel URL in prod)
- **Cron worker** — Inngest scheduled functions handle this; no separate setup

---

## Out of scope (Phase 5+)

- Custom domain for tracking pixel (better deliverability) — v1.5
- Outlook reply detection — Phase 4.5 follow-up plan, parallel to Gmail
- A/B subject testing — v1.5
- "Draft, don't send" reply assist — v1.2

---

## Acceptance criteria

- [ ] Real campaign of 5 leads completes from launch to inbox in <2 min, all open/click pixels firing
- [ ] Reply to one of the test emails triggers classification within 60s and stops the sequence
- [ ] Replying with "unsubscribe" lands the address in the suppression list before the next sequence step would have fired
- [ ] Tag `phase-4-complete`

Plan to flesh into full task-level detail (with code blocks per the Phase 2/3 pattern) when we resume.
