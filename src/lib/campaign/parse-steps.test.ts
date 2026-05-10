import { describe, it, expect } from "vitest";
import { parseStepsFromFormData } from "./parse-steps";

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

describe("parseStepsFromFormData", () => {
  it("parses a single step with no delay", () => {
    const fd = formData({
      "step[0][intentPrompt]": "Introduce myself and ask for a call",
      "step[0][delayDays]": "0",
    });
    const steps = parseStepsFromFormData(fd);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({ stepIndex: 0, intentPrompt: "Introduce myself and ask for a call", delayDays: 0 });
  });

  it("parses multiple steps preserving order", () => {
    const fd = formData({
      "step[0][intentPrompt]": "First touch",
      "step[0][delayDays]": "0",
      "step[1][intentPrompt]": "Follow up lightly",
      "step[1][delayDays]": "5",
      "step[2][intentPrompt]": "Final breakup email",
      "step[2][delayDays]": "7",
    });
    const steps = parseStepsFromFormData(fd);
    expect(steps).toHaveLength(3);
    expect(steps[1]).toEqual({ stepIndex: 1, intentPrompt: "Follow up lightly", delayDays: 5 });
    expect(steps[2].delayDays).toBe(7);
  });

  it("throws when intentPrompt is empty", () => {
    const fd = formData({
      "step[0][intentPrompt]": "  ",
      "step[0][delayDays]": "0",
    });
    expect(() => parseStepsFromFormData(fd)).toThrow(/intent/i);
  });

  it("throws when no steps found", () => {
    expect(() => parseStepsFromFormData(new FormData())).toThrow(/step/i);
  });

  it("clamps delayDays to non-negative integer", () => {
    const fd = formData({
      "step[0][intentPrompt]": "Hello",
      "step[0][delayDays]": "-3",
    });
    const steps = parseStepsFromFormData(fd);
    expect(steps[0].delayDays).toBe(0);
  });
});
