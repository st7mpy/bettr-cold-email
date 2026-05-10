export interface ParsedStep {
  stepIndex: number;
  intentPrompt: string;
  delayDays: number;
}

/**
 * Extracts ordered sequence steps from a FormData whose keys follow the
 * pattern: step[N][intentPrompt] and step[N][delayDays].
 */
export function parseStepsFromFormData(fd: FormData): ParsedStep[] {
  const indexSet = new Set<number>();
  for (const key of fd.keys()) {
    const m = key.match(/^step\[(\d+)\]/);
    if (m) indexSet.add(Number(m[1]));
  }

  if (indexSet.size === 0) throw new Error("No sequence steps found in form");

  const steps: ParsedStep[] = [];
  for (const idx of Array.from(indexSet).sort((a, b) => a - b)) {
    const intentPrompt = String(fd.get(`step[${idx}][intentPrompt]`) ?? "").trim();
    if (!intentPrompt) {
      throw new Error(`Step ${idx}: intent prompt is required`);
    }
    const rawDelay = Number(fd.get(`step[${idx}][delayDays]`) ?? "0");
    const delayDays = Math.max(0, Math.floor(isNaN(rawDelay) ? 0 : rawDelay));
    steps.push({ stepIndex: idx, intentPrompt, delayDays });
  }
  return steps;
}
