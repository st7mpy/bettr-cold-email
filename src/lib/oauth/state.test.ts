import { describe, it, expect } from "vitest";
import { generateState, verifyState } from "./state";

describe("generateState / verifyState", () => {
  it("produces a URL-safe token of reasonable length", () => {
    const s = generateState();
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s.length).toBeGreaterThanOrEqual(20);
  });

  it("two calls produce different states", () => {
    expect(generateState()).not.toBe(generateState());
  });

  it("verifyState returns true on exact match", () => {
    const s = generateState();
    expect(verifyState(s, s)).toBe(true);
  });

  it("verifyState returns false on mismatch", () => {
    expect(verifyState("aaaaa", "bbbbb")).toBe(false);
  });

  it("verifyState returns false when either side is empty/null", () => {
    expect(verifyState("", "x")).toBe(false);
    expect(verifyState(null, "x")).toBe(false);
    expect(verifyState("x", null)).toBe(false);
  });

  it("verifyState returns false when lengths differ (no leak)", () => {
    expect(verifyState("short", "muchlonger")).toBe(false);
  });
});
