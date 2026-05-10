import { describe, it, expect, vi, beforeEach } from "vitest";

const haiku = vi.fn();
const opus = vi.fn();

vi.mock("@/lib/llm/claude", () => ({
  callHaikuStructured: (args: unknown) => haiku(args),
  callOpusStructured: (args: unknown) => opus(args),
}));

const { classifyReply } = await import("./classify");

describe("classifyReply", () => {
  beforeEach(() => {
    haiku.mockReset();
    opus.mockReset();
  });

  it("short-circuits on kill-words without calling the LLM", async () => {
    const r = await classifyReply({
      body: "please unsubscribe me from this list",
    });
    expect(r.classification).toBe("unsubscribe");
    expect(r.killWordHit).toBe("unsubscribe");
    expect(haiku).not.toHaveBeenCalled();
    expect(opus).not.toHaveBeenCalled();
  });

  it("matches kill-words case-insensitively", async () => {
    const r = await classifyReply({ body: "TAKE ME OFF the list" });
    expect(r.classification).toBe("unsubscribe");
  });

  it("returns Haiku result when confidence >= 0.85", async () => {
    haiku.mockResolvedValueOnce({
      classification: "positive",
      confidence: 0.92,
      summary: "wants a call",
    });
    const r = await classifyReply({ body: "happy to chat next week" });
    expect(r.classification).toBe("positive");
    expect(opus).not.toHaveBeenCalled();
  });

  it("escalates to Opus when Haiku confidence < 0.85", async () => {
    haiku.mockResolvedValueOnce({
      classification: "unrelated",
      confidence: 0.4,
      summary: "?",
    });
    opus.mockResolvedValueOnce({
      classification: "question",
      confidence: 0.95,
      summary: "asks about pricing",
    });
    const r = await classifyReply({ body: "what does this cost?" });
    expect(r.classification).toBe("question");
    expect(opus).toHaveBeenCalledOnce();
  });
});
