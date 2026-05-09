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
