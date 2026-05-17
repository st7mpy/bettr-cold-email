import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
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
  postalAddress: text("postal_address"),
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
  }
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
  emailAccountId: uuid("email_account_id").references(() => emailAccounts.id, {
    onDelete: "set null",
  }),
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
  (t) => [
    uniqueIndex("seq_step_unique_per_campaign").on(t.campaignId, t.stepIndex),
  ]
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
  (t) => [index("leads_campaign_status_idx").on(t.campaignId, t.status)]
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
  (t) => [
    index("emails_lead_idx").on(t.leadId),
    index("emails_thread_idx").on(t.threadId),
  ]
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
  handledAt: timestamp("handled_at", { withTimezone: true }),
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
  (t) => [primaryKey({ columns: [t.userId, t.email] })]
);

// ---------- usage_log ----------
export const usageLog = pgTable("usage_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
