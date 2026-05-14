# Bettr Cold Email — Relay · Handoff

## Stack
- **Next.js 16** (App Router), TypeScript, Tailwind v4, shadcn/ui
- **Clerk** — auth + user webhooks
- **Drizzle ORM** + **Supabase Postgres** — pooler URL for runtime, direct URL for migrations
- **Inngest v4** — background jobs (concurrency, cron, step sleep)
- **Anthropic SDK** — Opus 4.7 (draft) + Haiku 4.5 (critique/classify)
- **Tavily** — web research
- **Vercel** — deployment at `bettr-cold-email.vercel.app`

---

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
Full redesign across all 9 screens. Key files:
- `src/app/globals.css` — complete token system, utility classes, animations
- `src/components/ui/design.tsx` — `Icon`, `Pill`, `Btn`, `SectionLabel`, `Stat`, `StatusDot`
- `src/components/layout/sidebar.tsx` — 224px, paper-2, quota bar

### Phase 6 · Production hardening ✓ (commit b36ef59)
- **Sidebar quota bar** — reads `emailAccounts.sentToday / dailyQuota` live; progress bar computed
- **Sidebar inbox badge** — counts `replies` where `classification IN ('positive','question')` joined through user's campaigns
- **Campaign detail `positive` count** — joins `replies` table on `emailId IN campaign emails`, count `classification='positive'`
- **Suppression remove** — `removeFromSuppression` server action in `suppression/actions.ts`; button is now wired and styled red
- **Settings usage stats** — counts `emails` with `status='sent'` since month start, estimates `$cost = count × $0.065`, counts distinct `leadId`s for "Leads researched"

---

## Remaining gaps (manual / env setup)

| Issue | Where | Action |
|---|---|---|
| Inbox "Mark handled" does nothing | `inbox-client.tsx` | Phase 8: add `handledAt` column + migration + server action |
| Onboarding doesn't gate Gmail OAuth | `onboarding/page.tsx` | Step 0 should block step 1 until Gmail is connected |
| Google OAuth in Testing mode | Google Cloud Console | Add `siddharth77work@gmail.com` as test user **OR** publish (needs privacy policy) |
| Inngest cloud keys missing on Vercel | Vercel env vars | Add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` from app.inngest.com |

---

## Next phases

### Phase 7 · Privacy policy + OAuth verification
**Goal:** Unblock any Google account from signing in (currently restricted to test users).

1. Create `src/app/privacy/page.tsx` — minimal privacy policy (what data collected, how used, contact email)
2. Google Cloud Console → OAuth consent screen → **Publish app** → submit for verification
3. Fill in: App homepage = `bettr-cold-email.vercel.app`, Privacy policy = `bettr-cold-email.vercel.app/privacy`
4. Google review takes 1–7 days for sensitive scopes (`gmail.send`, `gmail.modify`)

### Phase 8 · Reply management UI
**Goal:** Inbox is read-only today; replies need actionable workflows.

1. `replies` table: add `handledAt timestamp` column + `drizzle-kit generate` + push migration
2. Inbox "Mark handled" server action — stamps `handledAt`, excludes from actionable filter
3. "Reply in Gmail" — wire to thread deep-link: `https://mail.google.com/mail/#inbox/${threadId}` instead of `mailto:`
4. Auto-stop logic: when reply is `positive` or `negative`, set `leads.status = 'stopped'` and cancel pending follow-ups (Inngest cancel by `leadId` key)

### Phase 9 · Multi-account + billing
**Goal:** Support more than one sender account + enforce plan limits.

1. Remove `uniqueIndex("one_active_email_account_per_user")` constraint
2. Per-campaign: let user pick which connected account (`emailAccountId` FK on `campaigns`)
3. Track API spend per campaign (`usage_log` table: `userId, campaignId, model, inputTokens, outputTokens, createdAt`)
4. Enforce monthly email cap at send time
5. Stripe: checkout session on sign-up, webhook stamps `users.plan`, gate launch behind `plan='paid'`

### Phase 10 · Outlook + other providers
**Goal:** Remove Gmail monopoly.

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
      layout.tsx                      # AppShell + auth gate + quota/inbox fetch
      page.tsx                        # Campaign list + stat strip
      campaigns/
        new/
          page.tsx                    # New campaign form
          actions.ts                  # createCampaign, launchCampaign, generateSamples
          sequence-builder.tsx        # Client: add/remove steps
        [campaignId]/
          page.tsx                    # Campaign detail + leads table + positive count
          leads/[leadId]/
            page.tsx                  # Server: fetch trace data
            lead-trace-client.tsx     # Client: animated 6-stage reveal
      inbox/
        page.tsx                      # Server: fetch replies
        inbox-client.tsx              # Client: split panel
      suppression/
        page.tsx                      # Suppression list
        actions.ts                    # removeFromSuppression server action
      settings/page.tsx               # Account + usage stats (live)
  api/
    inngest/route.ts                  # Inngest handler (all 5 functions)
    oauth/google/                     # start + callback
    track/open/[emailId]/             # 1×1 GIF pixel
    track/click/[emailId]/            # 302 redirect
    unsubscribe/[emailId]/            # GET form + POST action
    webhooks/clerk/                   # User sync
  components/
    ui/design.tsx                     # Icon, Pill, Btn, SectionLabel, Stat, StatusDot
    layout/sidebar.tsx                # 224px sidebar — props: sentToday, dailyQuota, inboxCount
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
