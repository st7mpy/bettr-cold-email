# Relay Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Relay project: Next.js 15 App Router with TypeScript, Tailwind, shadcn/ui, Clerk auth, Drizzle ORM against Supabase Postgres, the full DB schema, an onboarding flow, and a base dashboard layout. End state: a signed-in user with a postal address recorded can land on `/dashboard` and see an empty shell.

**Architecture:** Single Next.js repo deployed to Vercel. Clerk handles auth UI and session; we mirror Clerk's `user.created` webhook into our own `users` table so foreign keys and our domain logic stay in our DB. Drizzle ORM for schema-as-code with raw-SQL feel. shadcn/ui for unstyled, copy-paste components.

**Tech Stack:** Next.js 15 (App Router), TypeScript 5, Tailwind v4, shadcn/ui, Clerk, Drizzle ORM, Postgres (Supabase), pnpm, Vitest for unit/integration tests, Playwright for end-to-end (defer setup to Phase 2 when there's UI worth E2E-ing).

---

## Phase roadmap (this plan covers Phase 1 only)

| Phase | Scope | End state |
|---|---|---|
| **1. Foundation** *(this plan)* | Project scaffold, auth, schema, onboarding, base layout | Logged-in user lands on empty dashboard |
| 2. Email account connection | Gmail/Outlook OAuth, token storage + refresh, send-test-email | User connects an inbox and sends a test email |
| 3. CSV + agent pipeline (no send) | Lead model, CSV upload + column mapping, full agent pipeline (research → hooks → groundedness → draft → critique → revise) writing to `emails` table | User can preview generated emails for an uploaded CSV |
| 4. Send + track | Inngest send scheduler, throttling/pacing, tracking pixel, click wrap, push subscriptions | Emails go out; opens/clicks/replies recorded |
| 5. Reply classification + sequences | Haiku reply classifier, hard kill-words, suppression list, sequence scheduler, follow-ups | Full sequences run end-to-end |
| 6. Dashboard + reply inbox + polish | Campaign dashboard, lead drill-down, reply inbox, settings UI | Shippable MVP |

---

## Pre-flight: external service accounts

Before starting Task 1, ensure these accounts exist and credentials are accessible. If any are missing, the dev work in Tasks 3, 6, and beyond will block.

- [ ] **Supabase project created** → grab `DATABASE_URL` (the pooled / "transaction" connection string for serverless) and `DIRECT_URL` (the direct connection for migrations)
- [ ] **Clerk application created** → grab `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- [ ] **Clerk webhook signing secret** generated (we'll use this in Task 7) → `CLERK_WEBHOOK_SIGNING_SECRET`

If you don't have these yet, get them now. Tasks 3 and 6 will fail without them.

---

## File structure (after Phase 1)

```
relay/
├── .env.example                       # template, committed
├── .env.local                         # secrets, NOT committed
├── .gitignore                         # already exists
├── components.json                    # shadcn config
├── drizzle.config.ts                  # drizzle-kit config
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── drizzle/                           # generated migrations
│   └── 0000_initial.sql
├── docs/superpowers/                  # already exists
└── src/
    ├── middleware.ts                  # Clerk auth + onboarding gate
    ├── app/
    │   ├── layout.tsx                 # root layout with ClerkProvider
    │   ├── globals.css
    │   ├── page.tsx                   # marketing/landing (signed-out) → redirect (signed-in)
    │   ├── api/
    │   │   └── webhooks/
    │   │       └── clerk/route.ts     # user.created → upsert users row
    │   ├── sign-in/[[...sign-in]]/page.tsx
    │   ├── sign-up/[[...sign-up]]/page.tsx
    │   ├── onboarding/
    │   │   ├── page.tsx               # postal address form
    │   │   └── actions.ts             # server action to save
    │   └── dashboard/
    │       ├── layout.tsx             # sidebar + topbar shell
    │       └── page.tsx               # empty placeholder
    ├── components/
    │   ├── ui/                        # shadcn primitives (button, card, input, form, label)
    │   └── layout/
    │       ├── sidebar.tsx
    │       └── topbar.tsx
    ├── db/
    │   ├── index.ts                   # drizzle client singleton
    │   ├── schema.ts                  # all tables
    │   └── schema.test.ts             # smoke test that schema queries work
    └── lib/
        ├── utils.ts                   # shadcn cn() helper
        ├── auth.ts                    # ensureUserRow(clerkId) helper
        └── auth.test.ts
```

---

## Task 1: Scaffold Next.js project + base dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.env.example`

**Note on TDD:** Pure scaffolding has no meaningful unit test. Verification is "the dev server boots and serves the homepage."

- [ ] **Step 1: Create the Next.js app in the existing directory**

We can't `pnpm create next-app` into a non-empty directory directly, so use the `--use-pnpm --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` flags into a temp dir then move files.

```bash
cd C:/Users/kotec/projects/relay
# create-next-app needs an empty target; run in a temp dir then move
pnpm create next-app@latest .relay-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
# move all files (including dotfiles) up
mv .relay-tmp/* .relay-tmp/.* . 2>/dev/null || true
rmdir .relay-tmp
```

If the move complains about `.gitignore` collision, manually merge: keep our existing `.gitignore` (it's more comprehensive).

- [ ] **Step 2: Verify the dev server boots**

```bash
pnpm dev
```

Expected: server starts on `http://localhost:3000`, default Next.js welcome page renders. Stop with Ctrl-C.

- [ ] **Step 3: Add `.env.example` template**

```bash
# .env.example
# Database (Supabase)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://USER:PASSWORD@HOST:5432/postgres

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Tavily (Phase 3+)
TAVILY_API_KEY=tvly-xxx

# Inngest (Phase 4+)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

- [ ] **Step 4: Install runtime deps we'll need throughout Phase 1**

```bash
pnpm add @clerk/nextjs drizzle-orm postgres svix
pnpm add -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom tsx
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "scaffold: bootstrap Next.js 15 with TS, Tailwind, App Router"
```

---

## Task 2: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/form.tsx`

- [ ] **Step 1: Run shadcn init**

```bash
pnpm dlx shadcn@latest init -d
```

Accept defaults: `New York` style, `Slate` base color, CSS variables.

- [ ] **Step 2: Add the components we need**

```bash
pnpm dlx shadcn@latest add button card input label
```

(`form` requires `react-hook-form`; deferred to Phase 2 when the campaign wizard needs it. Phase 1's onboarding form uses a plain server action and doesn't need the wrapper.)

- [ ] **Step 3: Verify by importing into the homepage**

Replace `src/app/page.tsx` with:

```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold">Relay</h1>
        <p className="text-muted-foreground">AI cold email, grounded.</p>
        <Button>Get started</Button>
      </div>
    </main>
  );
}
```

Run `pnpm dev`, confirm the button renders styled. Stop server.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "scaffold: add shadcn/ui with core primitives"
```

---

## Task 3: Set up Drizzle ORM with Postgres

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts` (initially empty placeholder)

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Create the DB client at `src/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const queryClient = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
```

- [ ] **Step 3: Create empty schema placeholder at `src/db/schema.ts`**

```ts
// Schema is defined in Task 4. This file exists so the drizzle client compiles.
export {};
```

- [ ] **Step 4: Verify config compiles**

```bash
pnpm exec drizzle-kit check
```

Expected: no errors (it'll say "Everything's fine" or similar — schema is empty so nothing to check yet, but the config must parse).

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "scaffold: add Drizzle ORM client + config"
```

---

## Task 4: Define the full DB schema

**Files:**
- Modify: `src/db/schema.ts` (replace with full schema)
- Create: `src/db/schema.test.ts`

- [ ] **Step 1: Write the schema**

Replace `src/db/schema.ts` with the full schema. This implements §5 of the spec.

```ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const emailProviderEnum = pgEnum("email_provider", ["gmail", "outlook"]);
export const emailAccountStatusEnum = pgEnum("email_account_status", [
  "active",
  "expired",
  "revoked",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "launched",
  "paused",
  "completed",
]);
export const modelTierEnum = pgEnum("model_tier", ["opus", "sonnet"]);
export const leadStatusEnum = pgEnum("lead_status", [
  "pending",
  "researching",
  "ready",
  "sending",
  "sent",
  "replied",
  "stopped",
  "bounced",
  "completed",
  "no_signal",
  "needs_review",
]);
export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sent",
  "bounced",
  "failed",
  "needs_review",
]);
export const replyClassificationEnum = pgEnum("reply_classification", [
  "positive",
  "negative",
  "out_of_office",
  "unsubscribe",
  "question",
  "unrelated",
]);

// ---------- users (mirror of Clerk) ----------
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  plan: text("plan").default("free").notNull(),
  postalAddress: text("postal_address"), // null until onboarding complete
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- email_accounts ----------
export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: emailProviderEnum("provider").notNull(),
    oauthAccessToken: text("oauth_access_token").notNull(),
    oauthRefreshToken: text("oauth_refresh_token").notNull(),
    oauthExpiresAt: timestamp("oauth_expires_at", { withTimezone: true }).notNull(),
    dailyQuota: integer("daily_quota").default(50).notNull(),
    sentToday: integer("sent_today").default(0).notNull(),
    lastResetAt: timestamp("last_reset_at", { withTimezone: true }).defaultNow().notNull(),
    watchSubscriptionId: text("watch_subscription_id"),
    watchExpiresAt: timestamp("watch_expires_at", { withTimezone: true }),
    status: emailAccountStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // MVP constraint: at most one active account per user
    oneActivePerUser: uniqueIndex("one_active_email_account_per_user")
      .on(t.userId)
      .where(sql`status = 'active'`),
  })
);

// ---------- campaigns ----------
export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goalText: text("goal_text"),
  senderPersona: text("sender_persona").notNull(),
  valueProp: text("value_prop").notNull(),
  modelTier: modelTierEnum("model_tier").default("opus").notNull(),
  status: campaignStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
});

// ---------- sequence_steps ----------
export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    intentPrompt: text("intent_prompt").notNull(),
    delayDays: integer("delay_days").default(0).notNull(),
  },
  (t) => ({
    uniquePerCampaign: uniqueIndex("seq_step_unique_per_campaign").on(
      t.campaignId,
      t.stepIndex
    ),
  })
);

// ---------- leads ----------
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    company: text("company"),
    title: text("title"),
    notes: text("notes"),
    customFields: jsonb("custom_fields").default({}).notNull(),
    status: leadStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byCampaignStatus: index("leads_campaign_status_idx").on(t.campaignId, t.status),
  })
);

// ---------- company_research (shared cache, 7-day TTL) ----------
export const companyResearch = pgTable("company_research", {
  company: text("company").primaryKey(),
  fundingSignals: jsonb("funding_signals"),
  newsSignals: jsonb("news_signals"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------- lead_research ----------
export const leadResearch = pgTable("lead_research", {
  leadId: uuid("lead_id")
    .primaryKey()
    .references(() => leads.id, { onDelete: "cascade" }),
  rawSearchResults: jsonb("raw_search_results"),
  fetchedPages: jsonb("fetched_pages"),
  hooks: jsonb("hooks"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------- emails ----------
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    hookUsed: jsonb("hook_used"),
    providerMessageId: text("provider_message_id"),
    threadId: text("thread_id"),
    status: emailStatusEnum("status").default("queued").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byLead: index("emails_lead_idx").on(t.leadId),
    byThread: index("emails_thread_idx").on(t.threadId),
  })
);

// ---------- replies ----------
export const replies = pgTable("replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  emailId: uuid("email_id")
    .notNull()
    .references(() => emails.id, { onDelete: "cascade" }),
  rawBody: text("raw_body").notNull(),
  fromAddress: text("from_address").notNull(),
  classification: replyClassificationEnum("classification"),
  classificationConfidence: integer("classification_confidence"), // 0-100
  summary: text("summary"),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- suppression_list ----------
export const suppressionList = pgTable(
  "suppression_list",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.email] }),
  })
);
```

- [ ] **Step 2: Write a smoke test that confirms each table is queryable**

Create `src/db/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { db } from "./index";
import {
  users,
  emailAccounts,
  campaigns,
  sequenceSteps,
  leads,
  companyResearch,
  leadResearch,
  emails,
  replies,
  suppressionList,
} from "./schema";

describe("schema", () => {
  it("each table is queryable (returns empty array on fresh DB)", async () => {
    expect(await db.select().from(users).limit(1)).toEqual([]);
    expect(await db.select().from(emailAccounts).limit(1)).toEqual([]);
    expect(await db.select().from(campaigns).limit(1)).toEqual([]);
    expect(await db.select().from(sequenceSteps).limit(1)).toEqual([]);
    expect(await db.select().from(leads).limit(1)).toEqual([]);
    expect(await db.select().from(companyResearch).limit(1)).toEqual([]);
    expect(await db.select().from(leadResearch).limit(1)).toEqual([]);
    expect(await db.select().from(emails).limit(1)).toEqual([]);
    expect(await db.select().from(replies).limit(1)).toEqual([]);
    expect(await db.select().from(suppressionList).limit(1)).toEqual([]);
  });
});
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15_000,
  },
});
```

Create `vitest.setup.ts`:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

Add `dotenv` dep:

```bash
pnpm add -D dotenv
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

(Don't replace existing `dev`/`build`/`start` scripts — add the new ones alongside.)

- [ ] **Step 4: The test will fail right now because no migration has run — proceed to Task 5**

Run the test to confirm the expected failure:

```bash
pnpm test src/db/schema.test.ts
```

Expected: FAIL with `relation "users" does not exist` (or similar) — this confirms our test reaches the DB but the schema isn't applied yet. Task 5 fixes this.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(db): define full schema with enums, tables, indexes"
```

---

## Task 5: Generate and apply the initial migration

**Files:**
- Create: `drizzle/0000_*.sql` (auto-generated)

- [ ] **Step 1: Generate the migration**

```bash
pnpm db:generate
```

Expected: a new file `drizzle/0000_<random_name>.sql` is created with `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX` statements matching the schema.

- [ ] **Step 2: Inspect the generated SQL**

Open `drizzle/0000_*.sql`. Verify:
- All 10 tables (`users`, `email_accounts`, `campaigns`, `sequence_steps`, `leads`, `company_research`, `lead_research`, `emails`, `replies`, `suppression_list`) have `CREATE TABLE` statements
- All 7 enum types are created
- The partial unique index on `email_accounts` includes `WHERE status = 'active'`
- Indexes on `leads (campaign_id, status)`, `emails (lead_id)`, `emails (thread_id)` are present

If anything is wrong, fix `schema.ts` and re-run generate (delete the stale migration first).

- [ ] **Step 3: Apply the migration to the dev database**

```bash
pnpm db:migrate
```

Expected: prints "Migrations applied" (or similar).

- [ ] **Step 4: Re-run the schema test from Task 4**

```bash
pnpm test src/db/schema.test.ts
```

Expected: PASS — all 10 table queries return `[]`.

- [ ] **Step 5: Commit**

```bash
git add drizzle/
git commit -m "feat(db): apply initial migration (10 tables, 7 enums)"
```

---

## Task 6: Set up Clerk authentication

**Files:**
- Create: `src/middleware.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Wrap root layout with `ClerkProvider`**

Replace `src/app/layout.tsx` body with:

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay",
  description: "AI cold email, grounded.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Create `src/middleware.ts`**

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 3: Create sign-in page at `src/app/sign-in/[[...sign-in]]/page.tsx`**

```tsx
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
```

- [ ] **Step 4: Create sign-up page at `src/app/sign-up/[[...sign-up]]/page.tsx`**

```tsx
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignUp />
    </main>
  );
}
```

- [ ] **Step 5: Manually verify**

```bash
pnpm dev
```

Visit `http://localhost:3000/dashboard` — expect redirect to `/sign-in`.
Sign up with a test email — expect to land back on `/dashboard` (which 404s for now; that's fine).
Visit `/sign-in` while signed in — Clerk handles the "already signed in" UX.
Stop server.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(auth): wire up Clerk with middleware-protected routes"
```

---

## Task 7: Mirror Clerk users into our `users` table

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/app/api/webhooks/clerk/route.ts`

This is where TDD kicks in. The webhook handler is real business logic.

- [ ] **Step 1: Write the test for `ensureUserRow`**

Create `src/lib/auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureUserRow } from "./auth";

describe("ensureUserRow", () => {
  beforeEach(async () => {
    // Clean up users created by earlier test runs
    await db.delete(users).where(eq(users.id, "user_test_123"));
  });

  it("inserts a new user row when one doesn't exist", async () => {
    await ensureUserRow({
      clerkId: "user_test_123",
      email: "test@example.com",
    });

    const rows = await db.select().from(users).where(eq(users.id, "user_test_123"));
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("test@example.com");
    expect(rows[0].postalAddress).toBeNull();
  });

  it("is idempotent — calling twice produces one row", async () => {
    await ensureUserRow({ clerkId: "user_test_123", email: "test@example.com" });
    await ensureUserRow({ clerkId: "user_test_123", email: "test@example.com" });

    const rows = await db.select().from(users).where(eq(users.id, "user_test_123"));
    expect(rows).toHaveLength(1);
  });

  it("does NOT overwrite postal_address on a repeat call", async () => {
    await ensureUserRow({ clerkId: "user_test_123", email: "test@example.com" });
    await db
      .update(users)
      .set({ postalAddress: "123 Main St" })
      .where(eq(users.id, "user_test_123"));

    await ensureUserRow({ clerkId: "user_test_123", email: "test@example.com" });

    const [row] = await db.select().from(users).where(eq(users.id, "user_test_123"));
    expect(row.postalAddress).toBe("123 Main St");
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
pnpm test src/lib/auth.test.ts
```

Expected: FAIL — module `./auth` not found.

- [ ] **Step 3: Implement `ensureUserRow`**

Create `src/lib/auth.ts`:

```ts
import { db } from "@/db";
import { users } from "@/db/schema";

export async function ensureUserRow(params: {
  clerkId: string;
  email: string;
}): Promise<void> {
  await db
    .insert(users)
    .values({ id: params.clerkId, email: params.email })
    .onConflictDoNothing({ target: users.id });
}
```

- [ ] **Step 4: Run test, confirm it passes**

```bash
pnpm test src/lib/auth.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Implement the Clerk webhook handler**

Create `src/app/api/webhooks/clerk/route.ts`:

```ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { ensureUserRow } from "@/lib/auth";
import { NextResponse } from "next/server";

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string | null;
  };
};

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkUserCreatedEvent;
  try {
    event = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const primary = event.data.email_addresses.find(
    (e) => e.id === event.data.primary_email_address_id
  );
  const email = primary?.email_address ?? event.data.email_addresses[0]?.email_address;

  if (!email) {
    return NextResponse.json({ error: "no email on user" }, { status: 400 });
  }

  await ensureUserRow({ clerkId: event.data.id, email });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Configure the webhook in Clerk Dashboard**

In the Clerk dashboard → Webhooks → Add endpoint:
- URL: `https://<your-vercel-deployment>/api/webhooks/clerk` (use a tunnel like `ngrok http 3000` for local; URL would be `https://<ngrok-id>.ngrok-free.app/api/webhooks/clerk`)
- Events: subscribe to `user.created`
- Copy the signing secret into `.env.local` as `CLERK_WEBHOOK_SIGNING_SECRET`

For local development without ngrok, also add a fallback: when the user lands on `/dashboard`, run `ensureUserRow` from a server component as a safety net (see Task 8 — we'll add this there).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(auth): mirror Clerk users into local users table on sign-up"
```

---

## Task 8: Onboarding gate (postal address collection)

**Files:**
- Create: `src/app/onboarding/page.tsx`, `src/app/onboarding/actions.ts`
- Modify: `src/middleware.ts` (add onboarding redirect logic)
- Modify: `src/lib/auth.ts` (add `getCurrentUserRow` helper)

We need to redirect signed-in users without a `postal_address` to `/onboarding`. CAN-SPAM requires this address before any campaign can launch, so it's mandatory at sign-up.

- [ ] **Step 1: Add `getCurrentUserRow` and a `requireOnboarded` helper to `src/lib/auth.ts`**

Append to `src/lib/auth.ts`:

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function getCurrentUserRow() {
  const { userId } = await auth();
  if (!userId) return null;

  // Safety net: if Clerk webhook hasn't fired yet (e.g. local dev without ngrok),
  // create the row from the current Clerk session.
  const [existing] = await db.select().from(users).where(eq(users.id, userId));
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  await ensureUserRow({ clerkId: userId, email });
  const [created] = await db.select().from(users).where(eq(users.id, userId));
  return created ?? null;
}
```

(Imports go at top of file; the `eq` and `auth`/`currentUser` imports might not be there yet.)

- [ ] **Step 2: Write the onboarding action**

Create `src/app/onboarding/actions.ts`:

```ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function saveOnboarding(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const postalAddress = String(formData.get("postalAddress") ?? "").trim();
  if (postalAddress.length < 10) {
    throw new Error("Please enter a complete postal address (min 10 chars).");
  }

  await db
    .update(users)
    .set({ postalAddress })
    .where(eq(users.id, userId));

  redirect("/dashboard");
}
```

- [ ] **Step 3: Write the onboarding page**

Create `src/app/onboarding/page.tsx`:

```tsx
import { saveOnboarding } from "./actions";
import { getCurrentUserRow } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OnboardingPage() {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (user.postalAddress) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>One more thing</CardTitle>
          <CardDescription>
            US law (CAN-SPAM) requires your postal address in the footer of every email
            you send. This is shown to recipients only and never to other Relay users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveOnboarding} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postalAddress">Postal address</Label>
              <Input
                id="postalAddress"
                name="postalAddress"
                placeholder="123 Main St, San Francisco, CA 94102"
                required
                minLength={10}
              />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Update middleware to gate `/dashboard` behind onboarding**

We *can't* query the DB from middleware (it runs on the edge). Instead, we redirect from a server component on `/dashboard`. Add this check to the dashboard layout in Task 9 — but for now, in `src/middleware.ts`, leave it as-is. The dashboard layout will handle the postal-address gate.

- [ ] **Step 5: Manually verify**

```bash
pnpm dev
```

Sign up a fresh test user → should land on `/dashboard` (which still 404s — that's Task 9). For now, manually visit `/onboarding` → see the form → submit a valid address → should redirect to `/dashboard`. Stop server.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(onboarding): postal address collection with server action"
```

---

## Task 9: Base dashboard layout (sidebar + topbar + empty home)

**Files:**
- Create: `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx`

- [ ] **Step 1: Create the sidebar**

Create `src/components/layout/sidebar.tsx`:

```tsx
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Campaigns" },
  { href: "/dashboard/inbox", label: "Reply inbox" },
  { href: "/dashboard/suppression", label: "Suppression" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/40 p-4">
      <div className="mb-6 text-lg font-semibold">Relay</div>
      <nav className="flex flex-col gap-1 text-sm">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create the topbar**

Create `src/components/layout/topbar.tsx`:

```tsx
import { UserButton } from "@clerk/nextjs";

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="text-sm text-muted-foreground">Cold email, grounded.</div>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
```

- [ ] **Step 3: Create the dashboard layout with onboarding gate**

Create `src/app/dashboard/layout.tsx`:

```tsx
import { getCurrentUserRow } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserRow();
  if (!user) redirect("/sign-in");
  if (!user.postalAddress) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the dashboard home page (empty state)**

Create `src/app/dashboard/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">Outreach you've launched.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No campaigns yet</CardTitle>
          <CardDescription>
            Connect an email account, then upload your first list of leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled>Coming in Phase 2</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Update homepage to redirect signed-in users to dashboard**

Replace `src/app/page.tsx`:

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-6 text-center">
        <h1 className="text-5xl font-bold">Relay</h1>
        <p className="text-lg text-muted-foreground">
          AI cold email, grounded in real research.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/sign-up"><Button size="lg">Get started</Button></Link>
          <Link href="/sign-in"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Manually verify the full flow**

```bash
pnpm dev
```

End-to-end happy path:
1. Visit `/` → see landing with "Get started" / "Sign in"
2. Click "Get started" → Clerk sign-up flow → enter email + verify
3. After verification → redirected to `/dashboard`
4. Dashboard layout's onboarding gate kicks in → redirected to `/onboarding`
5. Submit a postal address → redirected to `/dashboard`
6. Dashboard renders with sidebar, topbar, empty-state campaigns card
7. Click `UserButton` (top-right) → sign out → land on `/`

Confirm visually that everything renders without console errors.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(dashboard): base layout with sidebar, topbar, onboarding gate"
```

---

## Task 10: Smoke-test the full Phase 1 flow

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: PASS — schema test (1) + auth test (3) = 4 tests passing.

- [ ] **Step 2: Run typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: successful production build.

- [ ] **Step 5: Tag the milestone**

```bash
git tag phase-1-complete
```

If everything passes: Phase 1 is done. Time to plan Phase 2 (email account OAuth + send-test-email).

---

## Self-review checklist (run after the plan is written)

**Spec coverage:** Phase 1 covers spec §3 (tech stack), §4 (architecture skeleton), §5 (data model — full), and §8.1 (onboarding). Phase 1 does NOT cover §6 (agent pipeline), §7 (sending/replies), §8.2-8.5 (campaigns/inbox/settings UI), §9 (compliance — beyond postal address collection), §10 (testing strategy — eval harness deferred to Phase 3), §11 (risks — addressed as features land). All deferred items are explicit in the phase roadmap above.

**Placeholders:** None — every step has either runnable commands or full code.

**Type consistency:** `ensureUserRow` signature `{ clerkId: string; email: string }` is consistent across `auth.ts` definition (Task 7 Step 3), test (Task 7 Step 1), and webhook handler (Task 7 Step 5). `getCurrentUserRow` returns the user row or `null` consistently in `auth.ts` (Task 8 Step 1) and consumers in `dashboard/layout.tsx` (Task 9 Step 3) and `onboarding/page.tsx` (Task 8 Step 3). Schema enum names (`leadStatusEnum`, `emailStatusEnum`, etc.) are referenced consistently between definition (Task 4) and migration (Task 5).
