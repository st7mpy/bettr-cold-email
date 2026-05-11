"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/design";

interface Step {
  intentPrompt: string;
  delayDays: number;
}

const DEFAULTS: Step[] = [
  {
    intentPrompt:
      "Lead with the strongest hook from research. Two short paragraphs max. Be specific about the source so it doesn't read as flattery.",
    delayDays: 0,
  },
  {
    intentPrompt:
      "Light bump if no reply after a week. Reference a different angle from research, not the same one.",
    delayDays: 4,
  },
];

export function SequenceBuilder() {
  const [steps, setSteps] = useState<Step[]>(DEFAULTS);

  function addStep() {
    if (steps.length >= 5) return;
    setSteps((prev) => [...prev, { intentPrompt: "", delayDays: 7 }]);
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function update(i: number, field: keyof Step, val: string | number) {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "36px 1fr 110px 32px",
            gap: 12,
            alignItems: "start",
            padding: 14,
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            background: "var(--paper-2)",
          }}
        >
          {/* Step number */}
          <div
            className="mono tnum"
            style={{
              fontSize: 11,
              color: "var(--accent)",
              paddingTop: 10,
              letterSpacing: ".1em",
            }}
          >
            0{i + 1}
          </div>

          {/* Intent textarea */}
          <textarea
            className="textarea"
            name={`step[${i}][intentPrompt]`}
            rows={2}
            required
            minLength={10}
            value={step.intentPrompt}
            onChange={(e) => update(i, "intentPrompt", e.target.value)}
            placeholder={
              i === 0
                ? "Lead with the strongest hook from research…"
                : i === 1
                  ? "Light bump — different angle, no guilt…"
                  : "Last touch — one line, offer to step back."
            }
          />

          {/* Delay input */}
          <div>
            <label className="label" style={{ fontSize: 10 }}>
              Delay
            </label>
            {i === 0 ? (
              <>
                <input type="hidden" name="step[0][delayDays]" value="0" />
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    padding: "8px 10px",
                  }}
                >
                  on launch
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  name={`step[${i}][delayDays]`}
                  min={1}
                  max={30}
                  value={step.delayDays}
                  style={{ padding: "8px 10px" }}
                  onChange={(e) =>
                    update(i, "delayDays", Math.max(1, Number(e.target.value)))
                  }
                />
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--muted)" }}
                >
                  d
                </span>
              </div>
            )}
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={() => removeStep(i)}
            disabled={steps.length === 1}
            style={{
              color: "var(--muted)",
              padding: 6,
              opacity: steps.length === 1 ? 0.3 : 1,
              marginTop: 4,
            }}
            title="Remove step"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}

      {steps.length < 5 && (
        <button
          type="button"
          onClick={addStep}
          style={{
            padding: "12px 14px",
            border: "1px dashed var(--hairline)",
            borderRadius: 6,
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            transition: "border-color 120ms, color 120ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--rule)";
            (e.currentTarget as HTMLElement).style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--hairline)";
            (e.currentTarget as HTMLElement).style.color = "var(--muted)";
          }}
        >
          <Icon name="plus" size={14} />
          add step ({steps.length}/5)
        </button>
      )}
    </div>
  );
}
