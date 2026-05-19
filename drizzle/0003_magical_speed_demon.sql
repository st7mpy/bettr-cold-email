ALTER TABLE "emails" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "x_url" text;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";