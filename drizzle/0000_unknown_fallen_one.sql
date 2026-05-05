CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'launched', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."email_account_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('gmail', 'outlook');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'bounced', 'failed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('pending', 'researching', 'ready', 'sending', 'sent', 'replied', 'stopped', 'bounced', 'completed', 'no_signal', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('opus', 'sonnet');--> statement-breakpoint
CREATE TYPE "public"."reply_classification" AS ENUM('positive', 'negative', 'out_of_office', 'unsubscribe', 'question', 'unrelated');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"goal_text" text,
	"sender_persona" text NOT NULL,
	"value_prop" text NOT NULL,
	"model_tier" "model_tier" DEFAULT 'opus' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"launched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_research" (
	"company" text PRIMARY KEY NOT NULL,
	"funding_signals" jsonb,
	"news_signals" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "email_provider" NOT NULL,
	"oauth_access_token" text NOT NULL,
	"oauth_refresh_token" text NOT NULL,
	"oauth_expires_at" timestamp with time zone NOT NULL,
	"daily_quota" integer DEFAULT 50 NOT NULL,
	"sent_today" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watch_subscription_id" text,
	"watch_expires_at" timestamp with time zone,
	"status" "email_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"hook_used" jsonb,
	"provider_message_id" text,
	"thread_id" text,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_research" (
	"lead_id" uuid PRIMARY KEY NOT NULL,
	"raw_search_results" jsonb,
	"fetched_pages" jsonb,
	"hooks" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"company" text,
	"title" text,
	"notes" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "lead_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"raw_body" text NOT NULL,
	"from_address" text NOT NULL,
	"classification" "reply_classification",
	"classification_confidence" integer,
	"summary" text,
	"classified_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"intent_prompt" text NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppression_list_user_id_email_pk" PRIMARY KEY("user_id","email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"postal_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_research" ADD CONSTRAINT "lead_research_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_email_account_per_user" ON "email_accounts" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "emails_lead_idx" ON "emails" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "emails_thread_idx" ON "emails" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "leads_campaign_status_idx" ON "leads" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "seq_step_unique_per_campaign" ON "sequence_steps" USING btree ("campaign_id","step_index");