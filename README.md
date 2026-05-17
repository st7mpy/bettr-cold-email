# Relay

AI-powered cold outreach — researches leads, drafts personalised emails, and manages replies.

> Under active development. Not production-ready.

## What it does

- Connects Gmail or Outlook accounts via OAuth
- Imports leads from CSV, researches each one automatically (Tavily web search)
- Drafts personalised cold emails using Claude (Opus for drafting, Haiku for critique/verification)
- Sends through a quota-aware scheduler with pacing and suppression
- Detects and classifies replies; auto-stops follow-up sequences on positive/negative responses
- Multi-step drip sequences with configurable delays

## Stack

- **Next.js 15** App Router + TypeScript
- **Drizzle ORM** + Supabase Postgres
- **Inngest** for background jobs and durable workflows
- **Clerk** for authentication
- **Arctic** for OAuth (Google + Microsoft)
- **Stripe** for billing
- **Anthropic Claude** for research, drafting, and classification

## Setup

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_URL=
DIRECT_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
NEXT_PUBLIC_APP_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```

```bash
pnpm install
pnpm dev
```
