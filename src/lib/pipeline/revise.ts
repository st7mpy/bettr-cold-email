import { callSonnetStructured } from "@/lib/llm/claude";
import { DraftSchema, type Draft } from "./draft";
import type { Critique } from "./critique";

const SYSTEM = `You are revising a cold-email draft based on critic feedback.

- Address only the failed checks; do NOT regress on the passing ones.
- Keep the same hook reference and the same overall ask.
- Output JSON: {"subject": "...", "body": "..."}`;

export interface ReviseArgs {
  draft: Draft;
  critique: Critique;
  hookFact: string | null;
}

export async function reviseDraft(args: ReviseArgs): Promise<Draft> {
  const user = `Original subject: ${args.draft.subject}
Original body:
${args.draft.body}

Failed checks: ${args.critique.failures.join(", ") || "(none — but passes=false)"}
Suggestions: ${args.critique.suggestions}

Hook fact: ${args.hookFact ?? "(no hook)"}

Rewrite the email to fix the failed checks.`;

  return callSonnetStructured({
    system: SYSTEM,
    user,
    schema: DraftSchema,
    maxTokens: 800,
    cacheSystem: true,
  });
}
