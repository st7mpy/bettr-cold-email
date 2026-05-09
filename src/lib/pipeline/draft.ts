import { z } from "zod";
import { callOpusStructured } from "@/lib/llm/claude";
import type { ScoredHook } from "./hooks";

export type HookSelection =
  | { kind: "notes"; text: string }
  | { kind: "hook"; hook: ScoredHook }
  | { kind: "no_signal" };

export interface SelectHookArgs {
  notes?: string | null;
  hooks: ScoredHook[];
}

/**
 * Picks the best hook to ground the email on. Priority:
 * 1. User-supplied lead.notes (≥10 chars)
 * 2. person_hook with specificity ≥ 3
 * 3. person_hook with specificity 2
 * 4. company_hook with specificity ≥ 3
 * 5. no_signal (drafter writes a deliberately short, no-claim email)
 */
export function selectHook(args: SelectHookArgs): HookSelection {
  if (args.notes && args.notes.trim().length >= 10) {
    return { kind: "notes", text: args.notes.trim() };
  }

  const personHigh = args.hooks
    .filter((h) => h.type === "person_hook" && h.specificity_score >= 3)
    .sort((a, b) => b.specificity_score - a.specificity_score);
  if (personHigh.length > 0) return { kind: "hook", hook: personHigh[0] };

  const personMid = args.hooks.filter(
    (h) => h.type === "person_hook" && h.specificity_score === 2
  );
  if (personMid.length > 0) return { kind: "hook", hook: personMid[0] };

  const companyHigh = args.hooks
    .filter((h) => h.type === "company_hook" && h.specificity_score >= 3)
    .sort((a, b) => b.specificity_score - a.specificity_score);
  if (companyHigh.length > 0) return { kind: "hook", hook: companyHigh[0] };

  return { kind: "no_signal" };
}

export const DraftSchema = z.object({
  subject: z.string().min(3).max(120),
  body: z.string().min(20).max(2000),
});
export type Draft = z.infer<typeof DraftSchema>;

const SYSTEM_WITH_HOOK = `You write short, specific, human-feeling cold emails for sales/outreach/job-hunt.

Constraints:
- ≤6 sentences, ≤120 words
- Open with a specific reference grounded in the supplied hook (cite the source naturally, e.g. "saw your post on X about Y")
- One concrete ask
- Sign off with the user's first name
- Plain text, no marketing flourish

Output JSON: {"subject": "<short, specific, no clickbait>", "body": "<email body>"}`;

const SYSTEM_NO_SIGNAL = `You write short, honest cold emails when there's no specific personalization material.

Constraints:
- ≤4 sentences, ≤80 words
- Do NOT fabricate any specific reference to the recipient
- Lead with the user's value prop, not a forced compliment
- One concrete ask
- Sign off with the user's first name

Output JSON: {"subject": "<short>", "body": "<email body>"}`;

export interface DraftArgs {
  selection: HookSelection;
  senderPersona: string;
  valueProp: string;
  intentPrompt: string;
  recipient: { name: string; company: string; title?: string };
}

export async function draftEmail(args: DraftArgs): Promise<Draft> {
  const isNoSignal = args.selection.kind === "no_signal";

  const hookText =
    args.selection.kind === "notes"
      ? `User-provided context: ${args.selection.text}`
      : args.selection.kind === "hook"
        ? `Hook (${args.selection.hook.type}, source ${args.selection.hook.source_url}): ${args.selection.hook.fact}${
            args.selection.hook.quoted_phrase
              ? `\nVerbatim quote: "${args.selection.hook.quoted_phrase}"`
              : ""
          }`
        : "(no specific hook available)";

  const user = `Sender persona: ${args.senderPersona}
Value prop: ${args.valueProp}
Intent for this email: ${args.intentPrompt}

Recipient: ${args.recipient.name}, ${args.recipient.title ?? "—"} at ${args.recipient.company}

${hookText}

Write the email now.`;

  return callOpusStructured({
    system: isNoSignal ? SYSTEM_NO_SIGNAL : SYSTEM_WITH_HOOK,
    user,
    schema: DraftSchema,
    maxTokens: 800,
    cacheSystem: true,
  });
}
