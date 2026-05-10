import { inngest } from "../client";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { sql } from "drizzle-orm";

const QUOTA_RAMP = [50, 100, 150, 200, 250, 300, 350];

/**
 * Daily reset of `sent_today` and quota ramp-up over the first 7 days.
 * Runs at 00:00 UTC every day.
 */
export const resetQuotaFn = inngest.createFunction(
  {
    id: "reset-quota-daily",
    triggers: [{ cron: "0 0 * * *" }],
  },
  async ({ step }: { step: any }) => {
    await step.run("reset-and-ramp", async () => {
      // Bump quota along the ramp curve based on age, capped at 350
      const now = new Date();
      const accounts = await db.select().from(emailAccounts);
      for (const acc of accounts) {
        const ageDays = Math.floor(
          (now.getTime() - acc.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        );
        const target =
          ageDays >= QUOTA_RAMP.length - 1
            ? QUOTA_RAMP[QUOTA_RAMP.length - 1]
            : QUOTA_RAMP[Math.max(0, ageDays)];
        await db
          .update(emailAccounts)
          .set({ sentToday: 0, dailyQuota: target, lastResetAt: now })
          .where(sql`id = ${acc.id}`);
      }
      return { reset: accounts.length };
    });
  }
);
