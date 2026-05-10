"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Step {
  intentPrompt: string;
  delayDays: number;
}

export function SequenceBuilder() {
  const [steps, setSteps] = useState<Step[]>([
    { intentPrompt: "", delayDays: 0 },
  ]);

  function addStep() {
    setSteps((prev) => [...prev, { intentPrompt: "", delayDays: 3 }]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function update(i: number, field: keyof Step, val: string | number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {i === 0 ? "Step 1 — Initial email" : `Step ${i + 1} — Follow-up`}
            </span>
            {i > 0 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          {i > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor={`step-delay-${i}`} className="shrink-0">
                Send after
              </Label>
              <Input
                id={`step-delay-${i}`}
                name={`step[${i}][delayDays]`}
                type="number"
                min={1}
                max={30}
                value={step.delayDays}
                onChange={(e) => update(i, "delayDays", Number(e.target.value))}
                className="w-20"
              />
              <span className="text-muted-foreground">days</span>
            </div>
          )}
          {i === 0 && (
            <input type="hidden" name={`step[0][delayDays]`} value="0" />
          )}

          <div className="space-y-1">
            <Label htmlFor={`step-intent-${i}`}>Email intent</Label>
            <textarea
              id={`step-intent-${i}`}
              name={`step[${i}][intentPrompt]`}
              rows={3}
              required
              minLength={10}
              value={step.intentPrompt}
              onChange={(e) => update(i, "intentPrompt", e.target.value)}
              placeholder={
                i === 0
                  ? "Introduce myself, reference something specific they shipped, ask for a 15-min intro call."
                  : i === 1
                    ? "Light follow-up — check they saw my note, ask if it's a priority right now."
                    : "Final note — if it's not the right time, happy to reconnect in a few months."
              }
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      ))}

      {steps.length < 4 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          className="w-full"
        >
          + Add follow-up step
        </Button>
      )}
    </div>
  );
}
