import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "bettr-cold-email",
  // eventKey is optional locally — the inngest-cli dev server doesn't require it.
  ...(process.env.INNGEST_EVENT_KEY
    ? { eventKey: process.env.INNGEST_EVENT_KEY }
    : {}),
});

export type Events = {
  "lead/process": {
    data: {
      leadId: string;
      stepIndex?: number;
    };
  };
  "email/send": {
    data: {
      emailId: string;
    };
  };
  "lead/follow-up": {
    data: {
      leadId: string;
      nextStepIndex: number;
    };
  };
  "lead/stopped": {
    data: {
      leadId: string;
    };
  };
};
