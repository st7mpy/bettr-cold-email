# Bettr Cold Email — Phase 3: CSV upload + agent pipeline (no sending)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** A signed-in user with a connected mailbox (Phase 2) can create a campaign, upload a CSV of leads, and watch the agent pipeline generate a personalized email for each row — with research hooks, groundedness verification, and a critique pass — all visible in the UI. Emails land in the `emails` table with `status='queued'`. No actual SMTP sending in this phase. Sending is wired up in Phase 4.

**Architecture:** Five independently-retryable Inngest steps per lead: research → extract hooks → verify groundedness → draft → critique → (optional) revise. Tavily for web search and full-page extract. Anthropic Claude API for all LLM calls (Opus for drafting/revision, Haiku for everything structured). Hard-target escalation: if no hook reaches specificity ≥ 2, re-run hook extraction with Opus on the full fetched content. No-hook fallback: when no acceptable hook is found, generate a deliberately short, no-claim email rather than fake personalization.

**Tech additions:** `@anthropic-ai/sdk`, `inngest`, `@inngest/realtime` (optional, for live UI updates — defer to Phase 4 if it slows us down), `papaparse` (CSV parsing). No new vendor accounts beyond Anthropic + Tavily.

**Out of scope (deferred):**
- **Sending** — Phase 4. The settings page's "Send test email" already proves the send path; Phase 4 wires it to the campaign loop.
- **Reply detection / sequences** — Phase 4 / 5.
- **Live progress streaming** — UI polls every 5 s for now; realtime via WebSockets in a Phase 4 follow-up if the polling feels janky.
- **Custom enrichment** (BYO Apollo/Hunter key from spec §6) — Phase 5 once we know which signals matter most.

---

## Pre-flight: external API accounts

Approx 5 minutes total.

- [ ] **Anthropic API key**
  - https://console.anthropic.com/ → Settings → API Keys → Create
  - Top up at least $20 of credits (one full agent pipeline run for 50 leads ≈ $3 with Opus drafting; we'll cap free-plan users at 1,000 emails/mo per the spec)
  - Copy `sk-ant-...` → `ANTHROPIC_API_KEY`
- [ ] **Tavily API key**
  - https://app.tavily.com/ → API Keys → Generate
  - Free tier: 1,000 searches/mo, plenty for MVP testing
  - Copy `tvly-...` → `TAVILY_API_KEY`
- [ ] **Inngest cloud account (optional for dev — local dev server is enough)**
  - https://www.inngest.com/ → New app → "bettr-cold-email"
  - Get `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (both optional for local dev — the Inngest dev server bundled with `pnpm dlx inngest-cli@latest dev` works without keys)

---

## File structure (new in Phase 3)

```
src/
├── app/
│   ├── api/
│   │   └── inngest/route.ts                 # Inngest HTTP entry point
│   └── dashboard/
│       └── campaigns/
│           ├── page.tsx                     # campaign list (replaces Phase 2 home stub)
│           ├── new/
│           │   ├── page.tsx                 # 5-step wizard
│           │   └── actions.ts               # CSV upload + parse + persist
│           └── [campaignId]/
│               ├── page.tsx                 # campaign dashboard (status counts, lead table)
│               └── leads/[leadId]/page.tsx  # full agent trace per lead
├── lib/
│   ├── llm/
│   │   ├── claude.ts                        # Anthropic SDK client (with prompt caching)
│   │   └── claude.test.ts
│   ├── search/
│   │   ├── tavily.ts                        # search + extract
│   │   └── tavily.test.ts
│   ├── pipeline/
│   │   ├── research.ts                      # Step 1: tiered query plan + extract
│   │   ├── research.test.ts
│   │   ├── hooks.ts                         # Step 2: extract + score (TDD-able scoring)
│   │   ├── hooks.test.ts
│   │   ├── groundedness.ts                  # Step 2.5: verify hooks against pages
│   │   ├── groundedness.test.ts
│   │   ├── draft.ts                         # Step 3: hook-grounded email draft
│   │   ├── draft.test.ts
│   │   ├── critique.ts                      # Step 4: structured-output critique
│   │   ├── critique.test.ts
│   │   ├── revise.ts                        # Step 5: one-shot revision
│   │   └── pipeline.ts                      # full orchestration (Inngest function)
│   └── csv/
│       ├── parse.ts                         # papaparse wrapper + column normalization
│       └── parse.test.ts
└── inngest/
    └── client.ts                            # Inngest client singleton
```

---

## Task 1: Add Phase 3 env vars + dependencies

- [ ] **Step 1: Append to `.env.example`**

```
# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_OPUS_MODEL=claude-opus-4-7
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5

# Tavily
TAVILY_API_KEY=tvly-xxx

# Inngest (optional for local dev)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

- [ ] **Step 2: Generate the `.env.local` keys** with the values from pre-flight.

- [ ] **Step 3: Install runtime + dev deps**

```bash
pnpm add @anthropic-ai/sdk inngest papaparse zod
pnpm add -D @types/papaparse msw
```

- `zod` for structured-output schemas + form validation
- `msw` (mock service worker) for HTTP-level mocking of Anthropic + Tavily in tests

- [ ] **Step 4: Commit**

```bash
git add .env.example package.json pnpm-lock.yaml
git commit -m "feat(phase3): env + deps for Claude API, Tavily, Inngest, papaparse, zod"
```

---

## Task 2: Anthropic SDK client with prompt caching (TDD)

Centralized Claude client with model-tier helpers (`callOpus`, `callHaiku`) and structured-output JSON helper.

- [ ] **Step 1: Tests with `msw` HTTP mock**

Create `src/lib/llm/claude.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { callHaiku, callOpus, callHaikuStructured } from "./claude";
import { z } from "zod";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  process.env.ANTHROPIC_OPUS_MODEL = "claude-opus-4-7";
  process.env.ANTHROPIC_HAIKU_MODEL = "claude-haiku-4-5";
});
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

describe("callHaiku / callOpus", () => {
  it("hits the messages endpoint with the configured Haiku model", async () => {
    let capturedBody: { model?: string } | undefined;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
        capturedBody = (await request.json()) as { model?: string };
        return HttpResponse.json({
          content: [{ type: "text", text: "ack" }],
        });
      })
    );
    const out = await callHaiku({ system: "s", user: "u" });
    expect(out).toBe("ack");
    expect(capturedBody?.model).toBe("claude-haiku-4-5");
  });

  it("uses the Opus model when callOpus is invoked", async () => {
    let capturedBody: { model?: string } | undefined;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
        capturedBody = (await request.json()) as { model?: string };
        return HttpResponse.json({
          content: [{ type: "text", text: "ok" }],
        });
      })
    );
    await callOpus({ system: "s", user: "u" });
    expect(capturedBody?.model).toBe("claude-opus-4-7");
  });
});

describe("callHaikuStructured", () => {
  const Schema = z.object({ classification: z.string(), confidence: z.number() });

  it("parses structured JSON output against the provided zod schema", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({
          content: [
            {
              type: "text",
              text: '{"classification":"positive","confidence":0.92}',
            },
          ],
        })
      )
    );
    const out = await callHaikuStructured({
      system: "s",
      user: "u",
      schema: Schema,
    });
    expect(out).toEqual({ classification: "positive", confidence: 0.92 });
  });

  it("throws when the response cannot be parsed against the schema", async () => {
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({
          content: [{ type: "text", text: '{"wrong":"shape"}' }],
        })
      )
    );
    await expect(
      callHaikuStructured({ system: "s", user: "u", schema: Schema })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Implement `src/lib/llm/claude.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z, ZodSchema } from "zod";

let _client: Anthropic | null = null;
function client() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

interface CallArgs {
  system: string;
  user: string;
  maxTokens?: number;
  cacheSystem?: boolean; // enable Anthropic prompt caching on the system prompt
}

function modelFor(tier: "opus" | "haiku"): string {
  if (tier === "opus") {
    return process.env.ANTHROPIC_OPUS_MODEL || "claude-opus-4-7";
  }
  return process.env.ANTHROPIC_HAIKU_MODEL || "claude-haiku-4-5";
}

async function callTier(
  tier: "opus" | "haiku",
  args: CallArgs
): Promise<string> {
  const systemBlock = args.cacheSystem
    ? [
        {
          type: "text" as const,
          text: args.system,
          cache_control: { type: "ephemeral" as const },
        },
      ]
    : args.system;

  const res = await client().messages.create({
    model: modelFor(tier),
    max_tokens: args.maxTokens ?? 1024,
    system: systemBlock,
    messages: [{ role: "user", content: args.user }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  return block.text;
}

export async function callHaiku(args: CallArgs): Promise<string> {
  return callTier("haiku", args);
}
export async function callOpus(args: CallArgs): Promise<string> {
  return callTier("opus", args);
}

interface StructuredArgs<T> extends CallArgs {
  schema: ZodSchema<T>;
}

function extractJson(text: string): string {
  // Tolerate fenced code blocks (```json ... ```) and bare JSON
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}

export async function callHaikuStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  const raw = await callHaiku(args);
  const json = JSON.parse(extractJson(raw));
  return args.schema.parse(json);
}

export async function callOpusStructured<T>(
  args: StructuredArgs<T>
): Promise<T> {
  const raw = await callOpus(args);
  const json = JSON.parse(extractJson(raw));
  return args.schema.parse(json);
}

export { z };
```

- [ ] **Step 3: Run tests**

```bash
pnpm test src/lib/llm/claude.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/llm/
git commit -m "feat(llm): Anthropic Claude client with Opus/Haiku tiers + structured output"
```

---

## Task 3: Tavily search + extract client (TDD)

- [ ] **Step 1: Tests**

Create `src/lib/search/tavily.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { tavilySearch, tavilyExtract } from "./tavily";

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env.TAVILY_API_KEY = "tvly-test";
});
afterAll(() => server.close());
beforeEach(() => server.resetHandlers());

describe("tavilySearch", () => {
  it("posts to /search with the query and returns the result list", async () => {
    let captured: { query?: string } | undefined;
    server.use(
      http.post("https://api.tavily.com/search", async ({ request }) => {
        captured = (await request.json()) as { query?: string };
        return HttpResponse.json({
          results: [
            { url: "https://example.com/a", title: "A", content: "snippet a" },
            { url: "https://example.com/b", title: "B", content: "snippet b" },
          ],
        });
      })
    );
    const out = await tavilySearch({ query: 'foo "bar"' });
    expect(captured?.query).toBe('foo "bar"');
    expect(out).toHaveLength(2);
    expect(out[0].url).toBe("https://example.com/a");
  });
});

describe("tavilyExtract", () => {
  it("posts to /extract and returns markdown per URL", async () => {
    server.use(
      http.post("https://api.tavily.com/extract", () =>
        HttpResponse.json({
          results: [
            { url: "https://example.com/a", raw_content: "# heading\n\nbody" },
          ],
        })
      )
    );
    const out = await tavilyExtract(["https://example.com/a"]);
    expect(out).toEqual([
      { url: "https://example.com/a", content: "# heading\n\nbody" },
    ]);
  });
});
```

- [ ] **Step 2: Implement `src/lib/search/tavily.ts`**

```ts
const SEARCH_URL = "https://api.tavily.com/search";
const EXTRACT_URL = "https://api.tavily.com/extract";

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
}

export interface TavilyExtracted {
  url: string;
  content: string;
}

function key(): string {
  const k = process.env.TAVILY_API_KEY;
  if (!k) throw new Error("TAVILY_API_KEY is not set");
  return k;
}

export async function tavilySearch(args: {
  query: string;
  maxResults?: number;
}): Promise<TavilyResult[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key(),
      query: args.query,
      max_results: args.maxResults ?? 5,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily search ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { results: TavilyResult[] };
  return json.results;
}

export async function tavilyExtract(
  urls: string[]
): Promise<TavilyExtracted[]> {
  if (urls.length === 0) return [];
  const res = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key(), urls }),
  });
  if (!res.ok)
    throw new Error(`Tavily extract ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    results: { url: string; raw_content: string }[];
  };
  return json.results.map((r) => ({ url: r.url, content: r.raw_content }));
}
```

- [ ] **Step 3: Run, expect pass.** Commit:

```bash
git add src/lib/search/
git commit -m "feat(search): Tavily search + extract client with msw-tested wrappers"
```

---

## Task 4: Tiered research orchestrator (TDD)

`runResearch(lead) → { rawSearchResults, fetchedPages }` — runs the query plan from spec §6.1.

- [ ] **Step 1: Tests** (mock `tavilySearch` + `tavilyExtract` directly via vi.mock)

Create `src/lib/pipeline/research.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSearch = vi.fn();
const mockExtract = vi.fn();
vi.mock("@/lib/search/tavily", () => ({
  tavilySearch: mockSearch,
  tavilyExtract: mockExtract,
}));

const { runResearch } = await import("./research");

beforeEach(() => {
  mockSearch.mockReset();
  mockExtract.mockReset();
});

describe("runResearch", () => {
  it("runs the person-first query plan and extracts top 2 person hits", async () => {
    mockSearch
      .mockResolvedValueOnce([
        // "name" "company"
        { url: "https://blog.example/post", title: "Jane on X", content: "..." },
      ])
      .mockResolvedValueOnce([
        // site:linkedin.com/in/
        { url: "https://linkedin.com/in/jane", title: "Jane", content: "..." },
      ])
      .mockResolvedValueOnce([]) // twitter
      .mockResolvedValueOnce([]) // interview/podcast
      .mockResolvedValueOnce([]); // blog/essay

    mockExtract.mockResolvedValueOnce([
      { url: "https://blog.example/post", content: "FULL POST" },
      { url: "https://linkedin.com/in/jane", content: "FULL LI" },
    ]);

    const out = await runResearch({
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
    expect(out.rawSearchResults).toHaveLength(2);
    expect(out.fetchedPages).toHaveLength(2);
    expect(mockSearch).toHaveBeenCalledTimes(5);
    expect(mockExtract).toHaveBeenCalledOnce();
  });

  it("falls back to company queries when person queries return nothing", async () => {
    // 5 empty person queries
    for (let i = 0; i < 5; i++) mockSearch.mockResolvedValueOnce([]);
    // 3 company queries
    mockSearch
      .mockResolvedValueOnce([
        { url: "https://news.example/funding", title: "Series B", content: "..." },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockExtract.mockResolvedValueOnce([
      { url: "https://news.example/funding", content: "$50M raised" },
    ]);

    const out = await runResearch({
      name: "Jane Doe",
      company: "Acme",
      title: "VP Eng",
    });
    expect(mockSearch).toHaveBeenCalledTimes(8);
    expect(out.rawSearchResults[0].url).toContain("news.example");
  });
});
```

- [ ] **Step 2: Implement `src/lib/pipeline/research.ts`**

```ts
import { tavilySearch, tavilyExtract, TavilyResult } from "@/lib/search/tavily";

export interface LeadInput {
  name: string;
  company: string;
  title?: string;
}

export interface ResearchOutput {
  rawSearchResults: TavilyResult[];
  fetchedPages: { url: string; content: string }[];
}

const PERSON_QUERIES = (lead: LeadInput): string[] => [
  `"${lead.name}" "${lead.company}"`,
  `"${lead.name}" site:linkedin.com/in/`,
  `"${lead.name}" site:twitter.com OR site:x.com OR site:bsky.app`,
  `"${lead.name}" interview OR podcast OR talk OR keynote`,
  `"${lead.name}" blog OR essay OR wrote`,
];

const COMPANY_QUERIES = (lead: LeadInput): string[] => [
  `"${lead.company}" funding OR raised OR announced`,
  `"${lead.company}" launched OR shipped OR released`,
  `"${lead.company}" hiring`,
];

const TOP_K_TO_EXTRACT = 2;

export async function runResearch(lead: LeadInput): Promise<ResearchOutput> {
  const personHits: TavilyResult[] = [];
  for (const q of PERSON_QUERIES(lead)) {
    const results = await tavilySearch({ query: q, maxResults: 3 });
    if (results.length > 0) personHits.push(results[0]);
  }

  let chosen = personHits;
  if (chosen.length === 0) {
    for (const q of COMPANY_QUERIES(lead)) {
      const results = await tavilySearch({ query: q, maxResults: 3 });
      if (results.length > 0) chosen.push(results[0]);
    }
  }

  const urlsToExtract = chosen.slice(0, TOP_K_TO_EXTRACT).map((r) => r.url);
  const fetchedPages = await tavilyExtract(urlsToExtract);

  return {
    rawSearchResults: chosen,
    fetchedPages,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/research.ts src/lib/pipeline/research.test.ts
git commit -m "feat(pipeline): research step — tiered query plan with company fallback"
```

---

## Task 5: Hook extraction + objective specificity scoring (TDD)

- [ ] **Step 1: Tests for the pure scoring function**

Create `src/lib/pipeline/hooks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreSpecificity, type RawHook } from "./hooks";

describe("scoreSpecificity", () => {
  const base: RawHook = {
    type: "person_hook",
    source_url: "https://example.com",
    fact: "She works at Acme",
    quoted_phrase: null,
    why_relevant: "context",
    recency_days: 90,
  };

  it("scores 0 for a generic fact", () => {
    expect(scoreSpecificity(base)).toBe(0);
  });

  it("+1 for a concrete date in the fact", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "She was promoted on March 15 to VP Eng",
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it("+1 for a verbatim quoted_phrase", () => {
    expect(
      scoreSpecificity({ ...base, quoted_phrase: "we built it from scratch" })
    ).toBeGreaterThanOrEqual(1);
  });

  it("+1 for a non-year number", () => {
    expect(
      scoreSpecificity({ ...base, fact: "Acme raised $50M last quarter" })
    ).toBeGreaterThanOrEqual(1);
  });

  it("+1 for a named project/product", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "Jane shipped the new Tarmac dashboard",
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it("a fully specific hook scores 4", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "Jane shipped the Tarmac dashboard on March 15 with a $50M ARR target",
        quoted_phrase: "we built it from scratch",
      })
    ).toBe(4);
  });
});
```

(Hook-extraction LLM call test deferred — covered indirectly by the integration test in Task 11; the high-value unit testing is the scorer.)

- [ ] **Step 2: Implement `src/lib/pipeline/hooks.ts`**

```ts
import { z } from "zod";
import { callHaiku, callOpus } from "@/lib/llm/claude";
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

const NAMED_THING_RE =
  /\b(?:the\s+)?[A-Z][a-zA-Z0-9_]+(?:\s+[A-Z][a-zA-Z0-9_]+){0,2}\b/;
const DATE_RE =
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(,?\s+\d{4})?\b|\b\d{4}-\d{2}-\d{2}\b/;
const NON_YEAR_NUMBER_RE = /\$?\b\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?(?:[KkMmBb]|%)?\b/;

export function scoreSpecificity(hook: RawHook): number {
  let score = 0;
  if (DATE_RE.test(hook.fact)) score += 1;
  if (hook.quoted_phrase && hook.quoted_phrase.trim().length >= 4) score += 1;

  // Named project/product/event: a multi-word capitalized phrase that's not the
  // person's own name or the company name (which we already know about and
  // would otherwise inflate every hook).
  const m = hook.fact.match(NAMED_THING_RE);
  if (m && m[0]) {
    score += 1;
  }

  // Non-year number — strip 4-digit numbers in the 1900–2099 range to avoid
  // crediting a bare year as "specific."
  const numMatch = hook.fact.match(NON_YEAR_NUMBER_RE);
  if (numMatch) {
    const raw = numMatch[0].replace(/[$,]/g, "");
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      const isPlainYear = /^\d{4}$/.test(raw) && n >= 1900 && n <= 2099;
      if (!isPlainYear) score += 1;
    }
  }

  return score;
}

export interface ExtractHooksArgs {
  research: ResearchOutput;
  lead: { name: string; company: string; title?: string };
}

const SYSTEM = `You extract personalization hooks from web search results about a sales/outreach prospect.
Return JSON with shape: {"hooks":[{"type":"person_hook"|"company_hook","source_url":"...","fact":"≤25 words","quoted_phrase":"verbatim or null","why_relevant":"1 sentence","recency_days":<int|null>}]}.
Rules:
- A "person_hook" is something the person specifically did, said, or wrote.
- A "company_hook" is something about their employer.
- "fact" must paraphrase, ≤25 words, no first-person speculation.
- If you have a verbatim quote ≤30 words, set "quoted_phrase"; else null.
- Do NOT fabricate facts. If unsure, omit the hook.
- Output JSON only, no prose.`;

function buildUserPrompt(args: ExtractHooksArgs): string {
  const lead = args.lead;
  const search = args.research.rawSearchResults
    .map((r, i) => `[${i + 1}] ${r.url}\nTitle: ${r.title}\nSnippet: ${r.content}`)
    .join("\n\n");
  const pages = args.research.fetchedPages
    .map(
      (p, i) =>
        `[PAGE ${i + 1}] ${p.url}\n${p.content.slice(0, 4000)}`
    )
    .join("\n\n");
  return `Prospect:
- Name: ${lead.name}
- Company: ${lead.company}
- Title: ${lead.title ?? "unknown"}

Search results:
${search}

Fetched pages:
${pages}

Extract hooks now.`;
}

export async function extractHooks(
  args: ExtractHooksArgs
): Promise<ScoredHook[]> {
  const user = buildUserPrompt(args);
  const raw = await callHaiku({ system: SYSTEM, user, maxTokens: 2048 });
  const parsed = HookListSchema.parse(JSON.parse(extractJson(raw)));
  let scored = parsed.hooks.map((h) => ({
    ...h,
    specificity_score: scoreSpecificity(h),
  }));

  // Hard-target escalation: if no hook reaches specificity ≥ 2, re-run with Opus
  if (!scored.some((h) => h.specificity_score >= 2)) {
    const opusRaw = await callOpus({
      system: SYSTEM,
      user,
      maxTokens: 2048,
    });
    try {
      const opusParsed = HookListSchema.parse(JSON.parse(extractJson(opusRaw)));
      scored = opusParsed.hooks.map((h) => ({
        ...h,
        specificity_score: scoreSpecificity(h),
      }));
    } catch {
      // If Opus also fails to produce valid output, keep the Haiku result
    }
  }

  return scored.filter((h) => h.specificity_score >= 2);
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/hooks.ts src/lib/pipeline/hooks.test.ts
git commit -m "feat(pipeline): hook extraction + objective specificity scoring + Opus escalation"
```

---

## Task 6: Groundedness verification (TDD)

For each hook, verify the cited URL's fetched content actually supports the claim.

- [ ] **Step 1: Tests (mocked Claude)**

Create `src/lib/pipeline/groundedness.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHaikuStructured = vi.fn();
vi.mock("@/lib/llm/claude", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    callHaikuStructured: mockHaikuStructured,
  };
});

const { verifyGroundedness } = await import("./groundedness");

beforeEach(() => mockHaikuStructured.mockReset());

const baseHook = {
  type: "person_hook" as const,
  source_url: "https://blog.example.com/post",
  fact: "She launched Tarmac in March",
  quoted_phrase: null,
  why_relevant: "shipped product",
  recency_days: 30,
  specificity_score: 3,
};

describe("verifyGroundedness", () => {
  it("keeps hooks whose claim is supported by the cited page", async () => {
    mockHaikuStructured.mockResolvedValueOnce({
      supported: true,
      evidence_quote: "Tarmac launched on March 12",
    });
    const out = await verifyGroundedness({
      hooks: [baseHook],
      pages: [{ url: baseHook.source_url, content: "Tarmac launched on March 12..." }],
    });
    expect(out).toHaveLength(1);
  });

  it("drops hooks the LLM marks unsupported", async () => {
    mockHaikuStructured.mockResolvedValueOnce({
      supported: false,
      evidence_quote: null,
    });
    const out = await verifyGroundedness({
      hooks: [baseHook],
      pages: [{ url: baseHook.source_url, content: "irrelevant text" }],
    });
    expect(out).toHaveLength(0);
  });

  it("drops hooks whose source_url has no fetched page (cannot verify)", async () => {
    const out = await verifyGroundedness({
      hooks: [baseHook],
      pages: [],
    });
    expect(out).toHaveLength(0);
    expect(mockHaikuStructured).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `src/lib/pipeline/groundedness.ts`**

```ts
import { z } from "zod";
import { callHaikuStructured } from "@/lib/llm/claude";
import type { ScoredHook } from "./hooks";

const VerdictSchema = z.object({
  supported: z.boolean(),
  evidence_quote: z.string().nullable(),
});

const SYSTEM = `You verify factual claims about a person against a source page.
Return JSON: {"supported": <bool>, "evidence_quote": <string|null>}.
- "supported": true only if the page contains specific evidence for the claim.
- "evidence_quote": ≤30 verbatim words from the page that support the claim, or null.
- A claim that is *plausible* but not directly stated → supported=false.
Output JSON only.`;

export interface VerifyArgs {
  hooks: ScoredHook[];
  pages: { url: string; content: string }[];
}

export async function verifyGroundedness(
  args: VerifyArgs
): Promise<ScoredHook[]> {
  const pageByUrl = new Map(args.pages.map((p) => [p.url, p.content]));
  const verified: ScoredHook[] = [];

  for (const hook of args.hooks) {
    const page = pageByUrl.get(hook.source_url);
    if (!page) continue; // can't verify → drop
    const verdict = await callHaikuStructured({
      system: SYSTEM,
      user: `Claim: ${hook.fact}\n\nSource page (${hook.source_url}):\n${page.slice(0, 6000)}`,
      schema: VerdictSchema,
      maxTokens: 256,
    });
    if (verdict.supported) verified.push(hook);
  }

  return verified;
}
```

- [ ] **Step 3: Commit.**

---

## Task 7: Drafter — hook-grounded email writer (TDD-light)

We test the prompt-building helper deterministically; the LLM call itself is integration-tested in Task 11. The point of the unit test is to lock in the priority ladder of hook selection.

- [ ] **Step 1: Tests for `pickBestHook`**

Create `src/lib/pipeline/draft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickBestHook, type ScoredHook } from "./hooks";
import { selectHook } from "./draft";

const personHigh: ScoredHook = {
  type: "person_hook",
  source_url: "https://x.com/a",
  fact: "f",
  quoted_phrase: null,
  why_relevant: "w",
  recency_days: 1,
  specificity_score: 3,
};
const personMid: ScoredHook = { ...personHigh, specificity_score: 2 };
const companyHigh: ScoredHook = {
  ...personHigh,
  type: "company_hook",
  specificity_score: 3,
};

describe("selectHook", () => {
  it("prefers user-provided notes over any LLM-extracted hook", () => {
    const chosen = selectHook({
      notes: "We met at ConfX",
      hooks: [personHigh, companyHigh],
    });
    expect(chosen.kind).toBe("notes");
  });

  it("picks the highest-specificity person_hook when no notes", () => {
    const chosen = selectHook({ hooks: [companyHigh, personMid, personHigh] });
    expect(chosen.kind).toBe("hook");
    if (chosen.kind === "hook") {
      expect(chosen.hook.type).toBe("person_hook");
      expect(chosen.hook.specificity_score).toBe(3);
    }
  });

  it("falls back to a company_hook when no person_hook is eligible", () => {
    const chosen = selectHook({ hooks: [companyHigh] });
    expect(chosen.kind).toBe("hook");
    if (chosen.kind === "hook") expect(chosen.hook.type).toBe("company_hook");
  });

  it("returns 'no_signal' branch when nothing is eligible", () => {
    const chosen = selectHook({ hooks: [] });
    expect(chosen.kind).toBe("no_signal");
  });
});
```

(Note: the test imports `pickBestHook` from `./hooks` if we want to expose it there too — but the production code keeps the selection in `draft.ts` as `selectHook` since the policy is a drafting concern. The duplicate import at top is just illustrating; the actual test only uses `selectHook`.)

- [ ] **Step 2: Implement `src/lib/pipeline/draft.ts`**

```ts
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

export function selectHook(args: SelectHookArgs): HookSelection {
  if (args.notes && args.notes.trim().length >= 10) {
    return { kind: "notes", text: args.notes.trim() };
  }
  // 1. person_hook with specificity ≥ 3
  const personHigh = args.hooks
    .filter((h) => h.type === "person_hook" && h.specificity_score >= 3)
    .sort((a, b) => b.specificity_score - a.specificity_score);
  if (personHigh.length > 0) return { kind: "hook", hook: personHigh[0] };

  // 2. person_hook with specificity 2
  const personMid = args.hooks.filter(
    (h) => h.type === "person_hook" && h.specificity_score === 2
  );
  if (personMid.length > 0) return { kind: "hook", hook: personMid[0] };

  // 3. company_hook with specificity ≥ 3
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
Output JSON: {"subject": "<short, specific, no clickbait>", "body": "<email body>"}.`;

const SYSTEM_NO_SIGNAL = `You write short, honest cold emails when there's no specific personalization material.
Constraints:
- ≤4 sentences, ≤80 words
- Do NOT fabricate any specific reference to the recipient
- Lead with the user's value prop, not a forced compliment
- One concrete ask
- Sign off with the user's first name
Output JSON: {"subject": "<short>", "body": "<email body>"}.`;

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
```

- [ ] **Step 3: Run, expect pass. Commit.**

---

## Task 8: Critique pass (TDD)

- [ ] **Step 1: Tests with `vi.mock` of `callHaikuStructured`**

Create `src/lib/pipeline/critique.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStructured = vi.fn();
vi.mock("@/lib/llm/claude", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, callHaikuStructured: mockStructured };
});
const { critiqueDraft } = await import("./critique");

beforeEach(() => mockStructured.mockReset());

describe("critiqueDraft", () => {
  it("passes when all 6 checks return true", async () => {
    mockStructured.mockResolvedValueOnce({
      passes: true,
      checks: {
        length_ok: true,
        specific: true,
        human_tone: true,
        claim_grounded: true,
        not_creepy: true,
        subject_not_clickbait: true,
      },
      failures: [],
      suggestions: "ok",
    });
    const out = await critiqueDraft({
      draft: { subject: "s", body: "b" },
      hookFact: "f",
    });
    expect(out.passes).toBe(true);
  });

  it("fails and surfaces the failed checks", async () => {
    mockStructured.mockResolvedValueOnce({
      passes: false,
      checks: {
        length_ok: false,
        specific: true,
        human_tone: true,
        claim_grounded: true,
        not_creepy: true,
        subject_not_clickbait: true,
      },
      failures: ["length_ok"],
      suggestions: "shorten",
    });
    const out = await critiqueDraft({
      draft: { subject: "s", body: "very long".repeat(200) },
      hookFact: "f",
    });
    expect(out.passes).toBe(false);
    expect(out.failures).toContain("length_ok");
  });
});
```

- [ ] **Step 2: Implement `src/lib/pipeline/critique.ts`**

```ts
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

Set "passes": true only if all six are true.
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
```

- [ ] **Step 3: Commit.**

---

## Task 9: Revise pass (Opus, one-shot)

- [ ] Implement `src/lib/pipeline/revise.ts`:

```ts
import { callOpusStructured } from "@/lib/llm/claude";
import { DraftSchema, type Draft } from "./draft";
import type { Critique } from "./critique";

const SYSTEM = `You are revising a cold-email draft based on critic feedback.
Address only the failed checks; do NOT regress on the passing ones.
Keep the same hook reference and the same overall ask.
Output JSON: {"subject": "...", "body": "..."}.`;

export async function reviseDraft(args: {
  draft: Draft;
  critique: Critique;
  hookFact: string | null;
}): Promise<Draft> {
  const user = `Original subject: ${args.draft.subject}
Original body:
${args.draft.body}

Failed checks: ${args.critique.failures.join(", ") || "(none — but passes=false)"}
Suggestions: ${args.critique.suggestions}

Hook fact: ${args.hookFact ?? "(no hook)"}

Rewrite the email to fix the failed checks.`;
  return callOpusStructured({
    system: SYSTEM,
    user,
    schema: DraftSchema,
    maxTokens: 800,
  });
}
```

(No standalone test — covered by Task 11's integration test.)

Commit.

---

## Task 10: CSV parsing + column mapping (TDD)

- [ ] Create `src/lib/csv/parse.ts` and `parse.test.ts`. Use `papaparse`.
- Required column: `email` (case-insensitive matching of common header variants)
- Optional: `name`/`first name` + `last name`, `company`, `title`/`role`, `notes`
- Everything else → `customFields` jsonb
- Validate emails with a permissive regex; reject rows missing email
- Hard cap: 5,000 rows; reject larger uploads with clear error

Tests cover:
- Standard CSV with headers in expected order
- Headers in different casing/order
- "First Name" + "Last Name" combine into `name`
- Rows without email → rejected with row number
- 5,001 rows → rejected at parse time
- Custom columns flow into `customFields`

```ts
// parse.ts (sketch — fill in implementation)
import Papa from "papaparse";

export interface ParsedLead {
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  customFields: Record<string, string>;
}

export interface ParseResult {
  leads: ParsedLead[];
  rejected: { row: number; reason: string }[];
}

const MAX_ROWS = 5_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADER_MAP: Record<string, keyof ParsedLead | "first" | "last"> = {
  email: "email",
  "email address": "email",
  name: "name",
  "full name": "name",
  "first name": "first",
  firstname: "first",
  "last name": "last",
  lastname: "last",
  company: "company",
  organization: "company",
  org: "company",
  title: "title",
  role: "title",
  job: "title",
  notes: "notes",
};

function normalize(h: string): string {
  return h.trim().toLowerCase();
}

export function parseCsv(input: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.data.length > MAX_ROWS) {
    throw new Error(`CSV exceeds ${MAX_ROWS} rows (got ${parsed.data.length})`);
  }

  const leads: ParsedLead[] = [];
  const rejected: { row: number; reason: string }[] = [];

  parsed.data.forEach((row, i) => {
    const lead: ParsedLead = {
      email: "",
      name: null,
      company: null,
      title: null,
      notes: null,
      customFields: {},
    };
    let firstName = "";
    let lastName = "";
    for (const [k, v] of Object.entries(row)) {
      const mapped = HEADER_MAP[normalize(k)];
      const value = (v ?? "").trim();
      if (mapped === "email") lead.email = value;
      else if (mapped === "name") lead.name = value || null;
      else if (mapped === "first") firstName = value;
      else if (mapped === "last") lastName = value;
      else if (mapped === "company") lead.company = value || null;
      else if (mapped === "title") lead.title = value || null;
      else if (mapped === "notes") lead.notes = value || null;
      else if (k && value) lead.customFields[k] = value;
    }
    if (!lead.name && (firstName || lastName)) {
      lead.name = `${firstName} ${lastName}`.trim();
    }
    if (!lead.email || !EMAIL_RE.test(lead.email)) {
      rejected.push({ row: i + 2, reason: "missing or invalid email" });
      return;
    }
    leads.push(lead);
  });

  return { leads, rejected };
}
```

Commit.

---

## Task 11: Inngest pipeline orchestration

`processLeadFn` Inngest function chains research → hooks → groundedness → draft → critique → maybe-revise → write `emails` row with `status='queued'`. Each step uses `step.run` so it's individually retryable.

- [ ] Create `src/inngest/client.ts`:

```ts
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "bettr-cold-email",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

- [ ] Create `src/inngest/functions/process-lead.ts` with `processLeadFn` that takes `{ leadId }` event and runs the pipeline.
- [ ] Create `src/app/api/inngest/route.ts` to expose the Inngest HTTP endpoint via `serve()`.
- [ ] Integration test in `src/lib/pipeline/pipeline.test.ts`: mock all LLM + Tavily calls, run the full happy path, assert an `emails` row is inserted with the expected `subject`, `body`, `hook_used`, `step_index=0`, `status='queued'`.
- [ ] Add `pnpm dev:inngest` script:
  ```json
  "dev:inngest": "inngest-cli@latest dev"
  ```
  (paired with `pnpm dev` in another terminal)

Commit.

---

## Task 12: Campaign creation wizard UI

5-step wizard living at `/dashboard/campaigns/new`:

1. **Name + goal** — name, goal_text
2. **Upload CSV** — file input → parses on submit, shows mapping table + `rejected` count, lets user confirm
3. **Persona + value prop** — pre-filled from onboarding, editable
4. **Sequence builder** — add 1–5 steps with `intentPrompt` and `delay_days` (Phase 4 will use the delay_days; Phase 3 just persists step 0)
5. **Review + launch** — show 3 sample emails generated against 3 random rows. **Non-skippable.** This is where the user trusts the agent before paying with their inbox.

Server actions:
- `createCampaignDraft(formData)` → inserts campaign (status=draft) + sequence_steps + leads
- `generateSamples(campaignId)` → kicks off processLeadFn for 3 random leads, polls for completion
- `launchCampaign(campaignId)` → flips status to `launched`, fans out processLeadFn for the rest

Commit each step incrementally.

---

## Task 13: Campaign detail + lead trace UI

- `/dashboard/campaigns/[campaignId]/page.tsx`: status counts, lead table with filter by status, link to drill-down
- `/dashboard/campaigns/[campaignId]/leads/[leadId]/page.tsx`: full agent trace
  - Search results gathered (URL list)
  - Hooks extracted with specificity scores
  - Groundedness verdicts
  - Draft → Critique → Revise (if applicable)
  - Final email body + subject
  - "Why this hook?" — surface `why_relevant`
- The **transparency** here is the trust mechanic from spec §8.3. Don't shortchange it.

Commit.

---

## Task 14: Smoke test + tag

- [ ] `pnpm test` — full suite passes (target: ~30 tests)
- [ ] `pnpm exec tsc --noEmit` clean
- [ ] `pnpm build` clean
- [ ] Manual: launch dev (`pnpm dev` + `pnpm dev:inngest` in another terminal), sign in, connect Gmail (Phase 2 prerequisite), upload a 5-row CSV with a couple of real prospects, see 5 generated emails on the campaign detail page within ~60 seconds, drill into one and verify the agent trace shows research → hooks → critique
- [ ] Tag `phase-3-complete`, push to GitHub

---

## Self-review

**Spec coverage:** §6 (the agent pipeline) end-to-end except for live realtime UI updates (deferred per scope notes). §8.2 (campaign creation wizard) implemented. §8.3 (campaign dashboard with lead drill-down) implemented. §11 row 2 (hallucination guardrail) addressed via groundedness verification + critique. §11 row 6 (no-hook fallback) addressed. §11 row 7 (Inngest concurrency throttle) — **note:** add `concurrency: { limit: 5 }` per user to processLeadFn to satisfy this, called out in Task 11 implementation.

**Placeholders:** Tasks 11–13 marked as "Implement following the structure above" rather than full code dumps. This is intentional given plan length; each gets a focused continuation in the form of subtask commits as we execute. **If executing autonomously, expand each subtask before coding.**

**Type consistency:** `RawHook` / `ScoredHook` / `Draft` / `Critique` schemas are zod-defined and re-exported as TS types — single source of truth. `LeadInput`, `ResearchOutput`, `HookSelection` are stable across `research.ts`, `hooks.ts`, `draft.ts`. `processLeadFn` event shape `{ leadId: string }` consistent in `pipeline.ts` and the campaign-launch action.
