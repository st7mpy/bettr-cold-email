import { z } from "zod";
import { callHaikuStructured } from "@/lib/llm/claude";
import type { Draft } from "./draft";

export const CritiqueSchema = z.object({
  passes: z.boolean(),
  checks: z.object({
    length_ok: z.boolean(),
    specific: z.boolean(),
    human_tone: z.boolean(),
    claim_grounded: z.boolean(),
    not_creepy: z.boolean(),
    subject_not_clickbait: z.boolean(),
  }),
  failures: z.array(z.string()),
  suggestions: z.string(),
});
export type Critique = z.infer<typeof CritiqueSchema>;

const SYSTEM = `You are a critic for cold-email drafts. Run six checks:
- length_ok: body ≤150 words
- specific: not generic boilerplate
- human_tone: doesn't read as AI-written
- claim_grounded: every factual claim ties back to the supplied hook
- not_creepy: no surveillance-y references (e.g. inferring location, family)
- subject_not_clickbait: subject line is honest

Set "passes": true ONLY if all six checks are true.
"failures" lists the names of any check that returned false.
Output JSON only.`;

export interface CritiqueArgs {
  draft: Draft;
  hookFact: string | null;
}

export async function critiqueDraft(args: CritiqueArgs): Promise<Critique> {
  const user = `Hook fact: ${args.hookFact ?? "(no hook — short no-claim email)"}

Draft subject: ${args.draft.subject}
Draft body:
${args.draft.body}

Run the six checks now.`;

  return callHaikuStructured({
    system: SYSTEM,
    user,
    schema: CritiqueSchema,
    maxTokens: 512,
  });
}
