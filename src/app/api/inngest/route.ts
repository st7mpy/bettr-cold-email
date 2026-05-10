import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processLeadFn } from "@/inngest/functions/process-lead";
import { sendEmailFn } from "@/inngest/functions/send-email";
import { resetQuotaFn } from "@/inngest/functions/reset-quota";
import { followUpFn } from "@/inngest/functions/follow-up";
import { pollRepliesFn } from "@/inngest/functions/poll-replies";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processLeadFn,
    sendEmailFn,
    resetQuotaFn,
    followUpFn,
    pollRepliesFn,
  ],
});
