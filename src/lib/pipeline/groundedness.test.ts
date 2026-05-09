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
      pages: [
        {
          url: baseHook.source_url,
          content: "Tarmac launched on March 12...",
        },
      ],
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
