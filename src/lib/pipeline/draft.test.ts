import { describe, it, expect } from "vitest";
import type { ScoredHook } from "./hooks";
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

  it("ignores notes shorter than 10 chars", () => {
    const chosen = selectHook({
      notes: "hi",
      hooks: [personHigh],
    });
    expect(chosen.kind).toBe("hook");
  });

  it("picks the highest-specificity person_hook when no notes", () => {
    const chosen = selectHook({
      hooks: [companyHigh, personMid, personHigh],
    });
    expect(chosen.kind).toBe("hook");
    if (chosen.kind === "hook") {
      expect(chosen.hook.type).toBe("person_hook");
      expect(chosen.hook.specificity_score).toBe(3);
    }
  });

  it("picks a person_hook with score 2 over a company_hook with score 3", () => {
    const chosen = selectHook({ hooks: [companyHigh, personMid] });
    expect(chosen.kind).toBe("hook");
    if (chosen.kind === "hook") expect(chosen.hook.type).toBe("person_hook");
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
