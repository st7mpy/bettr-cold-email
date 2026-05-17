import { z } from "zod";
import { callHaiku, callSonnet } from "@/lib/llm/claude";
import type { ResearchOutput } from "./research";

export const RawHookSchema = z.object({
  type: z.enum(["person_hook", "company_hook"]),
  source_url: z.string().url(),
  fact: z.string().min(5).max(200),
  quoted_phrase: z.string().nullable(),
  why_relevant: z.string(),
  recency_days: z.number().int().nullable(),
});
export type RawHook = z.infer<typeof RawHookSchema>;

export interface ScoredHook extends RawHook {
  specificity_score: number;
}

const HookListSchema = z.object({ hooks: z.array(RawHookSchema) });

const DATE_RE =
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(,?\s+\d{4})?\b|\b\d{4}-\d{2}-\d{2}\b/i;

// Match a multi-word capitalized phrase (likely a named project/product/event).
// Single capitalized words match too many false positives (sentence starts,
// people's names already known to us). Two+ capitals catches "Tarmac Dashboard"
// or "Series B" without the noise.
const NAMED_THING_RE = /\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){1,3}\b/;

const NUMBER_RE = /\$?\b\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?(?:[KkMmBb]|%)?\b/;

export function scoreSpecificity(hook: RawHook): number {
  let score = 0;
  if (DATE_RE.test(hook.fact)) score += 1;
  if (hook.quoted_phrase && hook.quoted_phrase.trim().length >= 4) score += 1;

  if (NAMED_THING_RE.test(hook.fact)) score += 1;

  // Non-year number — strip 4-digit numbers in the 1900–2099 range to avoid
  // crediting a bare year as "specific."
  const numMatch = hook.fact.match(NUMBER_RE);
  if (numMatch) {
    const raw = numMatch[0].replace(/[$,]/g, "");
    const isPlainYear =
      /^\d{4}$/.test(raw) && Number(raw) >= 1900 && Number(raw) <= 2099;
    if (!isPlainYear) score += 1;
  }

  return score;
}

export interface ExtractHooksArgs {
  research: ResearchOutput;
  lead: { name: string; company: string; title?: string };
}

const SYSTEM = `You extract personalization hooks from web search results about a sales/outreach prospect.

Return JSON with shape:
{"hooks":[{"type":"person_hook"|"company_hook","source_url":"...","fact":"≤25 words","quoted_phrase":"verbatim or null","why_relevant":"1 sentence","recency_days":<int|null>}]}

Rules:
- A "person_hook" is something the person specifically did, said, or wrote.
- A "company_hook" is something about their employer.
- "fact" must paraphrase, ≤25 words, no first-person speculation.
- If you have a verbatim quote ≤30 words, set "quoted_phrase"; else null.
- Do NOT fabricate facts. If unsure, omit the hook.
- Output JSON only, no prose.`;

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}

function buildUserPrompt(args: ExtractHooksArgs): string {
  const lead = args.lead;
  const search = args.research.rawSearchResults
    .map(
      (r, i) =>
        `[${i + 1}] ${r.url}\nTitle: ${r.title}\nSnippet: ${r.content}`
    )
    .join("\n\n");
  const pages = args.research.fetchedPages
    .map((p, i) => `[PAGE ${i + 1}] ${p.url}\n${p.content.slice(0, 4000)}`)
    .join("\n\n");
  return `Prospect:
- Name: ${lead.name}
- Company: ${lead.company}
- Title: ${lead.title ?? "unknown"}

Search results:
${search || "(none)"}

Fetched pages:
${pages || "(none)"}

Extract hooks now.`;
}

export async function extractHooks(
  args: ExtractHooksArgs
): Promise<ScoredHook[]> {
  const user = buildUserPrompt(args);
  const raw = await callHaiku({ system: SYSTEM, user, maxTokens: 2048, cacheSystem: true });
  const parsed = HookListSchema.parse(JSON.parse(extractJson(raw)));
  let scored: ScoredHook[] = parsed.hooks.map((h) => ({
    ...h,
    specificity_score: scoreSpecificity(h),
  }));

  // Hard-target escalation: if no hook reaches specificity ≥ 2, re-run with Sonnet
  if (!scored.some((h) => h.specificity_score >= 2)) {
    try {
      const escalatedRaw = await callSonnet({
        system: SYSTEM,
        user,
        maxTokens: 2048,
        cacheSystem: true,
      });
      const escalatedParsed = HookListSchema.parse(JSON.parse(extractJson(escalatedRaw)));
      scored = escalatedParsed.hooks.map((h) => ({
        ...h,
        specificity_score: scoreSpecificity(h),
      }));
    } catch {
      // If escalation also fails to produce valid output, keep the Haiku result
    }
  }

  return scored.filter((h) => h.specificity_score >= 2);
}
