# Bettr Cold Email — Relay · Handoff

## Stack
- **Next.js 16** (App Router), TypeScript, Tailwind v4, shadcn/ui
- **Clerk** — auth + user webhooks
- **Drizzle ORM** + **Supabase Postgres** — pooler URL for runtime, direct URL for migrations
- **Inngest v4** — background jobs (concurrency, cron, step sleep)
- **Anthropic SDK** — Opus 4.7 (draft) + Haiku 4.5 (critique/classify)
- **Tavily** — web research
- **Vercel** — deployment at `bettr-cold-email.vercel.app`

## Completed phases

### Phase 1–2 · Foundation
Auth (Clerk), onboarding (postal address), DB schema, Google OAuth for Gmail, AES-256-GCM token encryption, CSV lead ingestion.

### Phase 3 · AI pipeline (`src/inngest/functions/process-lead.ts`)
Per-lead: tiered Tavily search → extract hooks → verify groundedness (Haiku) → draft email (Opus) → critique 6 checks (Haiku) → revise on fail → persist to `emails` table.

### Phase 4 · Send + track + reply detection
- `send-email.ts` — 30–120s randomised pacing, quota gate, suppression check, tracking URL rewrite, List-Unsubscribe header, fans out `lead/follow-up`
- `follow-up.ts` — sleeps `delayDays * 24h`, reuses research cache, persists threaded email
- `poll-replies.ts` — 15-min cron, threadId matching, kill-word bypass, Haiku classification (Opus escalate < 0.85 confidence)
- `reset-quota.ts` — daily cron, 7-day ramp [50→350]
- Tracking endpoints: `GET /api/track/open/[emailId]` (1×1 GIF), `GET /api/track/click/[emailId]` (302 redirect), `GET|POST /api/unsubscribe/[emailId]`

### Phase 5 · Stats + sequence builder
`computeCampaignStats`, `parseStepsFromFormData`, `SequenceBuilder` client component, active nav state, campaign detail engagement stats row.

### Design handoff (Dossier aesthetic)
Full redesign across all 9 screens matching `design_handoff_bettr_cold_email/`. Key files:
- `src/app/globals.css` — complete token system, utility classes, animations
- `src/components/ui/design.tsx` — `Icon`, `Pill`, `Btn`, `SectionLabel`, `Stat`, `StatusDot`
- `src/components/layout/sidebar.tsx` — 224px, paper-2, quota bar

---

## Known gaps / immediate fixes needed

| Issue | File | Fix |
|---|---|---|
| Sidebar quota bar hardcoded (142/350) | `sidebar.tsx` | Query `emailAccounts.sentToday / dailyQuota` for current user |
| Settings usage stats hardcoded ($0, 0 emails) | `settings/page.tsx` | Count from `emails` + estimate API cost |
| Campaign detail `positive` count always 0 | `[campaignId]/page.tsx` | Join `replies` table, count `classification='positive'` |
| Suppression "remove" button does nothing | `suppression/page.tsx` | Add server action: `DELETE FROM suppression_list WHERE userId=… AND email=…` |
| Inbox "Mark handled" does nothing | `inbox-client.tsx` | Add a `handled` boolean column to `replies` or filter by it |
| Onboarding only shows postal form; OAuth not gated | `onboarding/page.tsx` | Step 0 should enforce Gmail connected before step 1 |
| Google OAuth in Testing mode | Google Cloud Console | Add testers OR submit for verification (needs privacy policy URL) |
| Inngest cloud keys not set on Vercel | Vercel env vars | Add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` from app.inngest.com |

---

## Next phases

### Phase 6 · Production hardening
**Goal:** Everything actually works end-to-end on Vercel with real leads.

1. Wire live quota/usage into sidebar + settings (replace hardcoded values)
2. Fix `positive` reply count in campaign detail — join `replies` on `emails.campaignId`
3. Add server actions for: suppression remove, inbox mark-handled, settings save (daily cap, min gap)
4. Smoke test the full pipeline: create campaign → upload 5 leads → generate samples → launch → confirm Inngest jobs fire → confirm send → confirm reply detection
5. Set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` in Vercel (get from app.inngest.com)
6. Add `siddharth77work@gmail.com` as Google OAuth test user (or publish the OAuth app — needs privacy policy page)

### Phase 7 · Privacy policy + OAuth verification
**Goal:** Unblock any Google account from signing in (currently restricted to test users).

1. Create `src/app/privacy/page.tsx` — minimal privacy policy (what data collected, how used, contact email)
2. Go to Google Cloud Console → OAuth consent screen → **Publish app** → submit for verification
3. Fill in: App homepage = `bettr-cold-email.vercel.app`, Privacy policy = `bettr-cold-email.vercel.app/privacy`
4. Google review takes 1–7 days for apps with sensitive scopes (`gmail.send`, `gmail.modify`)

### Phase 8 · Reply management UI
**Goal:** Inbox is read-only today; replies need actionable workflows.

1. `replies` table: add `handledAt timestamp` column + migration
2. Inbox "Mark handled" server action — stamps `handledAt`, removes from actionable filter
3. "Reply in Gmail" already opens `mailto:` — wire it to actual thread deep-link (`https://mail.google.com/mail/#inbox/${threadId}`)
4. Auto-stop logic: when reply is `positive` or `negative`, set `leads.status = 'stopped'` and cancel pending follow-ups (Inngest cancel by `leadId` key)

### Phase 9 · Multi-account + billing
**Goal:** Support more than one sender account + enforce plan limits.

1. Remove the `uniqueIndex("one_active_email_account_per_user")` constraint
2. Per-campaign: let user pick which connected account to send from (`emailAccountId` FK on `campaigns`)
3. Track API spend per campaign (store in a `usage_log` table: `userId, campaignId, model, inputTokens, outputTokens, createdAt`)
4. Enforce monthly email cap at send time (query `emails` count for current calendar month)
5. Stripe integration: checkout session on sign-up, webhook stamps `users.plan`, gate launch behind `plan='paid'`

### Phase 10 · Outlook + other providers
**Goal:** Gmail monopoly removed.

1. Microsoft OAuth flow in `src/app/api/oauth/microsoft/` (similar to existing Google flow)
2. Abstract `src/lib/email/gmail.ts` behind `src/lib/email/send.ts` interface: `sendEmail({ account, to, subject, body, threadId })`
3. Implement `src/lib/email/outlook.ts` using Microsoft Graph API

---

## Env vars required on Vercel

```
DATABASE_URL            # Supabase pooler (port 6543)
DIRECT_URL              # Supabase direct (port 5432) — migrations only
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SIGNING_SECRET
NEXT_PUBLIC_APP_URL     # https://bettr-cold-email.vercel.app
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
ENCRYPTION_KEY          # 32 random bytes, base64
ANTHROPIC_API_KEY
TAVILY_API_KEY
INNGEST_EVENT_KEY       # from app.inngest.com — NOT YET SET
INNGEST_SIGNING_KEY     # from app.inngest.com — NOT YET SET
```

## Key file map

```
src/
  app/
    page.tsx                          # Landing
    onboarding/page.tsx               # Postal address + Gmail connect
    dashboard/
      layout.tsx                      # AppShell + auth gate
      page.tsx                        # Campaign list + stat strip
      campaigns/
        new/
          page.tsx                    # New campaign form
          actions.ts                  # createCampaign, launchCampaign, generateSamples
          sequence-builder.tsx        # Client: add/remove steps
        [campaignId]/
          page.tsx                    # Campaign detail + leads table
          leads/[leadId]/
            page.tsx                  # Server: fetch trace data
            lead-trace-client.tsx     # Client: animated 6-stage reveal
      inbox/
        page.tsx                      # Server: fetch replies
        inbox-client.tsx              # Client: split panel
      suppression/page.tsx
      settings/page.tsx
  api/
    inngest/route.ts                  # Inngest handler (all 5 functions)
    oauth/google/                     # start + callback
    track/open/[emailId]/             # 1×1 GIF pixel
    track/click/[emailId]/            # 302 redirect
    unsubscribe/[emailId]/            # GET form + POST action
    webhooks/clerk/                   # User sync
  components/
    ui/design.tsx                     # Icon, Pill, Btn, SectionLabel, Stat, StatusDot
    layout/sidebar.tsx
  db/schema.ts                        # Single source of truth for all tables
  inngest/
    client.ts                         # Typed Events
    functions/
      process-lead.ts                 # Research → draft pipeline
      send-email.ts                   # Paced send + tracking
      follow-up.ts                    # Threaded follow-ups
      poll-replies.ts                 # 15-min reply detection cron
      reset-quota.ts                  # Daily quota reset + ramp
  lib/
    email/gmail.ts                    # Gmail API send
    email/gmail-fetch.ts              # List + fetch messages
    email/wrap.ts                     # Tracking URL rewrite + unsubscribe footer
    llm/client.ts                     # Anthropic Opus/Haiku wrappers
    pipeline/                         # research, hooks, drafter, critique
    reply/classify.ts                 # Kill-word check + Haiku/Opus classify
    search/tavily.ts                  # Tiered search
    crypto/encrypt.ts                 # AES-256-GCM token encryption
```
