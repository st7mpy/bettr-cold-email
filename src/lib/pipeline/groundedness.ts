import { z } from "zod";
import { callHaikuStructured } from "@/lib/llm/claude";
import type { ScoredHook } from "./hooks";

const VerdictSchema = z.object({
  supported: z.boolean(),
  evidence_quote: z.string().nullable(),
});

const SYSTEM = `You verify factual claims about a person against a source page.

Return JSON: {"supported": <bool>, "evidence_quote": <string|null>}

- "supported": true ONLY if the page contains specific evidence for the claim.
- "evidence_quote": ≤30 verbatim words from the page that support the claim, or null.
- A claim that is *plausible* but not directly stated → supported=false.
- Output JSON only.`;

export interface VerifyArgs {
  hooks: ScoredHook[];
  pages: { url: string; content: string }[];
}

export async function verifyGroundedness(
  args: VerifyArgs
): Promise<ScoredHook[]> {
  const pageByUrl = new Map(args.pages.map((p) => [p.url, p.content]));
  const verifiable = args.hooks
    .map((hook) => ({ hook, page: pageByUrl.get(hook.source_url) }))
    .filter((x): x is { hook: ScoredHook; page: string } => Boolean(x.page));

  const verdicts = await Promise.all(
    verifiable.map(({ hook, page }) =>
      callHaikuStructured({
        system: SYSTEM,
        user: `Claim: ${hook.fact}\n\nSource page (${hook.source_url}):\n${page.slice(0, 6000)}`,
        schema: VerdictSchema,
        maxTokens: 256,
        cacheSystem: true,
      })
    )
  );

  return verifiable
    .filter((_, i) => verdicts[i].supported)
    .map(({ hook }) => hook);
}
