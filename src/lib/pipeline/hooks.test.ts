import { describe, it, expect } from "vitest";
import { scoreSpecificity, type RawHook } from "./hooks";

const base: RawHook = {
  type: "person_hook",
  source_url: "https://example.com",
  fact: "She works at Acme",
  quoted_phrase: null,
  why_relevant: "context",
  recency_days: 90,
};

describe("scoreSpecificity", () => {
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

  it("+1 for a non-year number ($-amount)", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "company raised $50M last quarter",
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it("does NOT credit a bare year as a 'number'", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "joined in 2024",
      })
    ).toBe(0);
  });

  it("+1 for a multi-word capitalized named project/product", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "Jane shipped the new Tarmac Dashboard",
      })
    ).toBeGreaterThanOrEqual(1);
  });

  it("a fully specific hook scores 4", () => {
    expect(
      scoreSpecificity({
        ...base,
        fact: "Jane shipped the Tarmac Dashboard on March 15 with a $50M ARR target",
        quoted_phrase: "we built it from scratch",
      })
    ).toBe(4);
  });
});
